import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { discoverScenarios } from "../util/discover-scenarios.js";
import { loadStepsFromTs } from "../util/load-ts.js";
import { loadStepsFromFile } from "../narrate/run-narrate.js";
import { fileExists } from "../util/narration-cache.js";
import {
  buildPresenterCacheFile,
  computePresenterHash,
  isPresenterCached,
  loadPresenterCache,
  presenterFingerprint,
  savePresenterCache,
} from "../util/presenter-cache.js";
import {
  HEYGEN_RATE_PER_MIN,
  type HeygenEngineFlag,
  type HeygenRequestContext,
  createAvatarVideo,
  downloadVideo,
  pollVideo,
  uploadAudioAsset,
} from "./heygen-client.js";
import { probeMp4Dimensions } from "./mp4-dimensions.js";

/** Default generation poll cadence and per-step budget. */
const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 15 * 60 * 1_000;
/** Progress-line cadence during a minutes-long generation. */
const PROGRESS_LOG_EVERY_MS = 30_000;

const CONTAINER = "mp4"; // fixed for v1 (Safari renders VP9-alpha opaque)

/** Options for {@link runPresenter}. Paths may be relative; resolved here. */
export interface RunPresenterOptions {
  /** A scenario YAML file, a .ts steps file, or a directory of scenarios. */
  readonly target: string;
  /** HeyGen avatar id. Falls back to the HEYGEN_AVATAR_ID env var. */
  readonly avatar?: string;
  /** Generation engine (default: iii). */
  readonly engine?: HeygenEngineFlag;
  /** Output resolution tier (default: 720p). */
  readonly resolution?: string;
  /** Output directory for clips (default: presenter/ beside the scenario). */
  readonly out?: string;
  /** URL path prefix for the `src` fields written into the manifest. */
  readonly baseUrl?: string;
  /** Skip the cost confirmation (CI / scripts). */
  readonly yes?: boolean;
  /** Progress sink for per-step/per-scenario messages (stderr). */
  readonly onLog?: (message: string) => void;
  /** Injectable confirmation prompt (the command wires util/confirm). */
  readonly confirmImpl?: (question: string) => Promise<boolean>;
  /** Whether stdin can answer a prompt (default: process.stdin.isTTY). */
  readonly isTty?: boolean;
  /** Test seams for the minutes-long polling loop. */
  readonly pollIntervalMs?: number;
  readonly pollTimeoutMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
}

/** Per-scenario presenter outcome. */
export interface PresentedScenario {
  readonly id: string;
  readonly generated: number;
  readonly cached: number;
  readonly failed: number;
  /** True when no step opts into the presenter (nothing to generate). */
  readonly skipped: boolean;
}

/** Aggregate result of a presenter run. */
export interface PresenterResult {
  readonly mode: "file" | "directory";
  readonly scenarios: PresentedScenario[];
  readonly totalGenerated: number;
  readonly totalCached: number;
  readonly totalFailed: number;
  readonly totalSkipped: number;
  readonly errors: Array<{ id: string; message: string }>;
  /** True when the cost gate was declined or unanswerable. */
  readonly aborted: boolean;
}

interface NarrationManifestFile {
  steps: Array<{ src: string; durationMs: number } | null>;
}

interface ResolvedConfig {
  readonly apiKey: string;
  readonly avatarId: string;
  readonly engine: HeygenEngineFlag;
  readonly resolution: string;
  readonly fingerprint: string;
}

/** Shorten an avatar id for display: de95f90d… → de95…8ad8. */
function shortAvatarId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id;
}

/**
 * Generate presenter clips for a scenario file or a directory of
 * scenarios — the orchestration behind `scenar presenter`. For each
 * step marked `presenter: true`, uploads that step's narration audio
 * to HeyGen, generates a lip-synced avatar clip, downloads it beside
 * the narration output, and writes a positional `presenter/manifest.json`
 * keyed to AUTHORED steps (like the narration manifest).
 *
 * Spend is visible and consented: before any paid call the batch
 * estimate is printed and confirmed (or `--yes`). Failures never
 * corrupt state — the manifest and cache are written from completed
 * work only, so a rerun regenerates exactly the missing steps.
 */
export async function runPresenter(options: RunPresenterOptions): Promise<PresenterResult> {
  const onLog = options.onLog ?? (() => {});

  // Every prerequisite that needs no network is checked before any work.
  const apiKey = process.env["HEYGEN_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "HEYGEN_API_KEY environment variable is not set.\n\n" +
        "Set it before running presenter:\n" +
        "  export HEYGEN_API_KEY=...",
    );
  }
  const avatarId = options.avatar ?? process.env["HEYGEN_AVATAR_ID"];
  if (!avatarId) {
    throw new Error("No avatar id. Pass --avatar <id> or set HEYGEN_AVATAR_ID.");
  }
  const engine = options.engine ?? "iii";
  const resolution = options.resolution ?? "720p";
  const config: ResolvedConfig = {
    apiKey,
    avatarId,
    engine,
    resolution,
    fingerprint: presenterFingerprint(engine, resolution, CONTAINER, avatarId),
  };

  const resolved = resolve(options.target);
  const info = await stat(resolved);

  return info.isDirectory()
    ? presentDirectory(resolved, options, config, onLog)
    : presentSingleFile(resolved, options, config, onLog);
}

async function presentSingleFile(
  filePath: string,
  options: RunPresenterOptions,
  config: ResolvedConfig,
  onLog: (message: string) => void,
): Promise<PresenterResult> {
  const scenarioDir = dirname(filePath);
  const id = basename(scenarioDir);
  const { steps } = await loadStepsFromFile(filePath);

  const outDir = options.out ?? join(scenarioDir, "presenter");
  const outcome = await presentScenario({
    scenarioId: id,
    steps,
    scenarioDir,
    outDir,
    options,
    config,
    onLog,
  });

  return {
    mode: "file",
    scenarios: [outcome.result],
    totalGenerated: outcome.result.generated,
    totalCached: outcome.result.cached,
    totalFailed: outcome.result.failed,
    totalSkipped: outcome.result.skipped ? 1 : 0,
    errors: [],
    aborted: outcome.aborted,
  };
}

async function presentDirectory(
  dirPath: string,
  options: RunPresenterOptions,
  config: ResolvedConfig,
  onLog: (message: string) => void,
): Promise<PresenterResult> {
  const scenarios = await discoverScenarios(dirPath);
  const results: PresentedScenario[] = [];
  const errors: Array<{ id: string; message: string }> = [];
  let totals = { generated: 0, cached: 0, failed: 0, skipped: 0 };
  let aborted = false;

  if (scenarios.length > 0) {
    onLog(`Discovered ${scenarios.length} scenario(s)`);
  }

  for (const scenario of scenarios) {
    onLog(`  ${scenario.id}`);
    try {
      const steps = await loadStepsFromTs(scenario.stepsPath);
      const scenarioDir = dirname(scenario.stepsPath);
      const outDir = options.out
        ? join(options.out, scenario.id)
        : join(scenarioDir, "presenter");

      const outcome = await presentScenario({
        scenarioId: scenario.id,
        steps,
        scenarioDir,
        outDir,
        options,
        config,
        onLog,
      });

      results.push(outcome.result);
      totals = {
        generated: totals.generated + outcome.result.generated,
        cached: totals.cached + outcome.result.cached,
        failed: totals.failed + outcome.result.failed,
        skipped: totals.skipped + (outcome.result.skipped ? 1 : 0),
      };
      if (outcome.aborted) {
        aborted = true;
        break; // a declined gate stops the batch — never spend past a "no"
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onLog(`    \x1b[31mfailed\x1b[0m: ${message}`);
      errors.push({ id: scenario.id, message });
    }
  }

  return {
    mode: "directory",
    scenarios: results,
    totalGenerated: totals.generated,
    totalCached: totals.cached,
    totalFailed: totals.failed,
    totalSkipped: totals.skipped,
    errors,
    aborted,
  };
}

interface PresentScenarioInput {
  readonly scenarioId: string;
  readonly steps: Array<{ narration?: string; narrationText?: string; presenter?: boolean }>;
  readonly scenarioDir: string;
  readonly outDir: string;
  readonly options: RunPresenterOptions;
  readonly config: ResolvedConfig;
  readonly onLog: (message: string) => void;
}

interface PlanStep {
  readonly index: number;
  readonly durationMs: number;
  readonly audioPath: string;
  readonly hash: string;
  readonly cached: boolean;
}

async function presentScenario(
  input: PresentScenarioInput,
): Promise<{ result: PresentedScenario; aborted: boolean }> {
  const { scenarioId, steps, scenarioDir, outDir, options, config, onLog } = input;

  const optedIn = steps
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => step.presenter === true);

  if (optedIn.length === 0) {
    return {
      result: { id: scenarioId, generated: 0, cached: 0, failed: 0, skipped: true },
      aborted: false,
    };
  }

  // Authoring contradiction (load-time rule, guarded here too in the
  // validator's wording): a presenter step must have a narration script.
  const unscripted = optedIn.filter(({ step }) => {
    const text = step.narration ?? step.narrationText;
    return typeof text !== "string" || text.length === 0;
  });
  if (unscripted.length > 0) {
    const indices = unscripted.map(({ index }) => index).join(", ");
    throw new Error(
      `steps[${indices}].presenter: presenter requires narration_text — ` +
        "a presenter clip is derived from the step's narration audio.",
    );
  }

  // Operational prerequisite: narration audio must already exist —
  // the clip is derived from it by definition.
  const narrationDir = join(scenarioDir, "narration");
  let narrationManifest: NarrationManifestFile | null = null;
  try {
    narrationManifest = JSON.parse(
      await readFile(join(narrationDir, "manifest.json"), "utf-8"),
    ) as NarrationManifestFile;
  } catch {
    // Reported below with the per-step gap list.
  }

  const missingAudio: number[] = [];
  const ready: Array<{ index: number; durationMs: number; audioPath: string }> = [];
  for (const { index } of optedIn) {
    const entry = narrationManifest?.steps[index];
    const audioPath = join(narrationDir, `step-${index}.mp3`);
    if (!entry || !(await fileExists(audioPath))) {
      missingAudio.push(index);
    } else {
      ready.push({ index, durationMs: entry.durationMs, audioPath });
    }
  }
  if (missingAudio.length > 0) {
    throw new Error(
      `steps ${missingAudio.join(", ")} opt into the presenter but have no narration audio. ` +
        `Run 'scenar narrate ${options.target}' first — presenter clips are derived from narration audio.`,
    );
  }

  // Cache pass: the per-step hash is the narration MP3 bytes, so
  // re-narrating a step invalidates its clip automatically.
  const existingCache = await loadPresenterCache(outDir);
  const plan: PlanStep[] = [];
  for (const step of ready) {
    const audioBytes = await readFile(step.audioPath);
    const hash = computePresenterHash(audioBytes);
    const clipPath = join(outDir, `step-${step.index}.mp4`);
    const cached =
      isPresenterCached(existingCache, step.index, hash, config.fingerprint) &&
      (await fileExists(clipPath));
    plan.push({ ...step, hash, cached });
  }

  const toGenerate = plan.filter((step) => !step.cached);

  // The plan — printed before anything spends money.
  onLog(
    `Presenter plan — ${scenarioId} (engine ${config.engine}, ${config.resolution}, ` +
      `avatar ${shortAvatarId(config.avatarId)})`,
  );
  for (const step of plan) {
    const seconds = (step.durationMs / 1000).toFixed(1);
    onLog(`  step ${step.index}   ${seconds}s   ${step.cached ? "cached" : "generate"}`);
  }

  if (toGenerate.length === 0) {
    onLog("Nothing to generate — all clips cached.");
    // Still (re)write manifest and cache from the cached clips, so a
    // deleted manifest regenerates without a paid call.
    await writeOutputs(outDir, scenarioId, steps.length, plan, [], options, config);
    return {
      result: { id: scenarioId, generated: 0, cached: plan.length, failed: 0, skipped: false },
      aborted: false,
    };
  }

  const totalAudioMs = toGenerate.reduce((sum, step) => sum + step.durationMs, 0);
  const rate = HEYGEN_RATE_PER_MIN[config.engine];
  const estimate = (totalAudioMs / 60_000) * rate;
  onLog(
    `Estimated cost: ${toGenerate.length} clip(s), ${(totalAudioMs / 1000).toFixed(1)}s audio → ` +
      `~$${estimate.toFixed(2)} (rate: ~$${rate.toFixed(2)}/min, engine ${config.engine})`,
  );

  // The cost gate. Never spend silently: a pipe that cannot answer must
  // pass --yes explicitly.
  if (!options.yes) {
    const isTty = options.isTty ?? process.stdin.isTTY === true;
    if (!isTty) {
      onLog("stdin is not a TTY; pass --yes to confirm the estimated spend.");
      return {
        result: { id: scenarioId, generated: 0, cached: 0, failed: 0, skipped: false },
        aborted: true,
      };
    }
    const confirmed = await input.options.confirmImpl?.("Proceed?");
    if (!confirmed) {
      onLog("Aborted — nothing generated, nothing spent.");
      return {
        result: { id: scenarioId, generated: 0, cached: 0, failed: 0, skipped: false },
        aborted: true,
      };
    }
  }

  // Sequential generation (HeyGen concurrency limits are unverified —
  // the sequential loop is the honest v1).
  const ctx: HeygenRequestContext = {
    apiKey: config.apiKey,
    sleep: options.sleep,
    onRetry: (message) => onLog(`  ${message}`),
  };
  await mkdir(outDir, { recursive: true });

  const completed: Array<{ index: number; durationMs: number; hash: string }> = [];
  let failed = 0;

  for (const step of toGenerate) {
    try {
      const audioBytes = await readFile(step.audioPath);
      const assetId = await uploadAudioAsset(ctx, audioBytes, `step-${step.index}.mp3`);
      const videoId = await createAvatarVideo(ctx, {
        avatarId: config.avatarId,
        audioAssetId: assetId,
        engine: config.engine,
        resolution: config.resolution,
        title: `scenar ${scenarioId} step-${step.index} ${step.hash.slice(0, 8)}`,
      });

      onLog(`  step ${step.index}: generating (video_id ${videoId.slice(0, 8)}…)`);
      let lastProgressMs = 0;
      const outcome = await pollVideo(ctx, videoId, {
        intervalMs: options.pollIntervalMs ?? POLL_INTERVAL_MS,
        timeoutMs: options.pollTimeoutMs ?? POLL_TIMEOUT_MS,
        onTick: (elapsedMs) => {
          if (elapsedMs - lastProgressMs >= PROGRESS_LOG_EVERY_MS) {
            lastProgressMs = elapsedMs;
            onLog(
              `  step ${step.index}: generating (video_id ${videoId.slice(0, 8)}…) ` +
                `${Math.round(elapsedMs / 1000)}s`,
            );
          }
        },
      });

      if (outcome.status === "timeout") {
        failed++;
        onLog(
          `\x1b[31m  step ${step.index}: timed out after ${Math.round(
            (options.pollTimeoutMs ?? POLL_TIMEOUT_MS) / 60_000,
          )}min — check video ${videoId} in the HeyGen dashboard\x1b[0m`,
        );
        continue;
      }
      if (outcome.status === "failed" || !outcome.videoUrl) {
        failed++;
        onLog(
          `\x1b[31m  step ${step.index}: HeyGen generation failed: ` +
            `${outcome.failureMessage ?? "no video_url returned"}\x1b[0m`,
        );
        continue;
      }

      const clip = await downloadVideo(outcome.videoUrl);
      await writeFile(join(outDir, `step-${step.index}.mp4`), clip);
      completed.push({ index: step.index, durationMs: step.durationMs, hash: step.hash });
      onLog(
        `\x1b[32m+\x1b[0m step ${step.index}: ${step.durationMs}ms clip (${clip.length} bytes)`,
      );
    } catch (error) {
      failed++;
      const message = error instanceof Error ? error.message : String(error);
      onLog(`\x1b[31m  step ${step.index}: ${message}\x1b[0m`);
    }
  }

  await writeOutputs(outDir, scenarioId, steps.length, plan, completed, options, config);

  const cachedCount = plan.filter((step) => step.cached).length;
  onLog(
    `\x1b[32m+\x1b[0m ${scenarioId}: ${completed.length} generated, ` +
      `${cachedCount} cached${failed > 0 ? `, \x1b[31m${failed} failed\x1b[0m` : ""}`,
  );

  return {
    result: {
      id: scenarioId,
      generated: completed.length,
      cached: cachedCount,
      failed,
      skipped: false,
    },
    aborted: false,
  };
}

interface ManifestEntry {
  src: string;
  durationMs: number;
  width?: number;
  height?: number;
}

/**
 * Write `manifest.json` and `.presenter-cache.json` from completed work
 * only (cached steps + this run's successes). Failed and non-opted
 * steps stay `null` — playback degrades to no-presenter on those steps
 * by design, and a rerun regenerates exactly the missing ones.
 *
 * Each entry carries the clip's probed pixel dimensions (scenar#30):
 * re-probed from the file on disk at every rewrite — never cached —
 * so they can never drift from the actual bytes, and a rerun over
 * cached clips upgrades a pre-probe manifest for free. A probe miss
 * only omits the fields (playback falls back to the 16:9 frame).
 */
async function writeOutputs(
  outDir: string,
  scenarioId: string,
  totalSteps: number,
  plan: PlanStep[],
  completed: Array<{ index: number; durationMs: number; hash: string }>,
  options: RunPresenterOptions,
  config: ResolvedConfig,
): Promise<void> {
  await mkdir(outDir, { recursive: true });

  const srcPrefix = options.baseUrl
    ? `${options.baseUrl.replace(/\/$/, "")}/${scenarioId}`
    : ".";

  const manifestEntries = new Map<number, ManifestEntry>();
  const cacheEntries = new Map<number, { hash: string; durationMs: number }>();

  const buildEntry = async (index: number, durationMs: number): Promise<ManifestEntry> => {
    const entry: ManifestEntry = { src: `${srcPrefix}/step-${index}.mp4`, durationMs };
    // The clip's existence is a precondition of reaching this map (the
    // cache check / this run's download), so a read failure surfaces.
    const dims = probeMp4Dimensions(await readFile(join(outDir, `step-${index}.mp4`)));
    if (dims) {
      entry.width = dims.width;
      entry.height = dims.height;
    }
    return entry;
  };

  for (const step of plan.filter((p) => p.cached)) {
    manifestEntries.set(step.index, await buildEntry(step.index, step.durationMs));
    cacheEntries.set(step.index, { hash: step.hash, durationMs: step.durationMs });
  }
  for (const step of completed) {
    manifestEntries.set(step.index, await buildEntry(step.index, step.durationMs));
    cacheEntries.set(step.index, { hash: step.hash, durationMs: step.durationMs });
  }

  const manifestSteps: Array<ManifestEntry | null> = Array.from(
    { length: totalSteps },
    () => null,
  );
  for (const [index, entry] of manifestEntries) {
    manifestSteps[index] = entry;
  }

  await writeFile(
    join(outDir, "manifest.json"),
    JSON.stringify({ steps: manifestSteps }, null, 2) + "\n",
  );
  await savePresenterCache(
    outDir,
    buildPresenterCacheFile(config.fingerprint, totalSteps, cacheEntries),
  );
}
