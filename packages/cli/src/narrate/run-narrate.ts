import { mkdir, writeFile, stat } from "node:fs/promises";
import { join, resolve, extname, basename, dirname } from "node:path";
import { loadScenarioYaml } from "../util/load-yaml.js";
import { loadStepsFromTs } from "../util/load-ts.js";
import { discoverScenarios } from "../util/discover-scenarios.js";
import {
  computeHash,
  loadCache,
  saveCache,
  fileExists,
  isCached,
  getCachedDuration,
  buildCacheFile,
} from "../util/narration-cache.js";
import { validateScenario } from "../validate/scenario-validator.js";
import { resolveProvider } from "../tts/resolve-provider.js";
import type { TtsProvider } from "../tts/types.js";

/** Options for {@link runNarrate}. Paths may be relative; resolved here. */
export interface RunNarrateOptions {
  /** A scenario YAML file, a .ts steps file, or a directory of scenarios. */
  readonly target: string;
  /** TTS provider name: echogarden, edge-tts, or openai (default echogarden). */
  readonly tts?: string;
  /** Output directory for audio (default: alongside the scenario). */
  readonly out?: string;
  /** Voice name (provider-specific). */
  readonly voice?: string;
  /** URL path prefix for the `src` fields written into the manifest. */
  readonly baseUrl?: string;
  /** Progress sink for per-step/per-scenario messages. */
  readonly onLog?: (message: string) => void;
}

/** Per-scenario narration outcome. */
export interface NarratedScenario {
  readonly id: string;
  readonly generated: number;
  readonly cached: number;
  /** True when the scenario had no narration text (nothing to synthesize). */
  readonly skipped: boolean;
}

/** Aggregate result of a narrate run. */
export interface NarrateResult {
  readonly mode: "file" | "directory";
  readonly scenarios: NarratedScenario[];
  readonly totalGenerated: number;
  readonly totalCached: number;
  readonly totalSkipped: number;
  readonly errors: Array<{ id: string; message: string }>;
}

interface StepWithNarration {
  index: number;
  text: string;
}

function extractNarratedSteps(
  steps: Array<{ narration?: string; narrationText?: string }>,
): StepWithNarration[] {
  const result: StepWithNarration[] = [];
  for (let i = 0; i < steps.length; i++) {
    const text = steps[i]!.narration ?? steps[i]!.narrationText;
    if (typeof text === "string" && text.length > 0) {
      result.push({ index: i, text });
    }
  }
  return result;
}

interface RuntimeManifestEntry {
  src: string;
  durationMs: number;
}

interface RuntimeManifest {
  steps: (RuntimeManifestEntry | null)[];
}

function buildRuntimeManifest(
  totalSteps: number,
  entries: Map<number, { src: string; durationMs: number }>,
): RuntimeManifest {
  const steps: (RuntimeManifestEntry | null)[] = Array.from({ length: totalSteps }, () => null);
  for (const [idx, entry] of entries) {
    steps[idx] = entry;
  }
  return { steps };
}

async function loadStepsFromFile(
  filePath: string,
): Promise<{ steps: Array<{ narration?: string; narrationText?: string }>; totalSteps: number }> {
  const ext = extname(filePath).toLowerCase();

  if (ext === ".ts" || ext === ".tsx") {
    const steps = await loadStepsFromTs(filePath);
    return { steps, totalSteps: steps.length };
  }

  const scenario = await loadScenarioYaml(filePath);
  const validation = validateScenario(scenario);
  if (!validation.valid) {
    throw new Error(
      `Scenario has ${validation.errors.length} error(s). Run 'scenar validate ${filePath}' for details.`,
    );
  }

  const steps = (scenario as Record<string, unknown>)["steps"] as
    | Array<Record<string, unknown>>
    | undefined;
  if (!steps) {
    throw new Error("No steps found in scenario.");
  }
  return { steps: steps as Array<{ narrationText?: string }>, totalSteps: steps.length };
}

interface GenerateOptions {
  scenarioId: string;
  narratedSteps: StepWithNarration[];
  totalSteps: number;
  outDir: string;
  voice: string;
  baseUrl?: string;
  provider: TtsProvider;
  onLog: (message: string) => void;
}

interface GenerateStats {
  generated: number;
  cached: number;
}

async function generateNarration(opts: GenerateOptions): Promise<GenerateStats> {
  const { scenarioId, narratedSteps, totalSteps, outDir, voice, baseUrl, provider, onLog } = opts;

  await mkdir(outDir, { recursive: true });

  const existingCache = await loadCache(outDir);
  const stats: GenerateStats = { generated: 0, cached: 0 };
  const manifestEntries = new Map<number, { src: string; durationMs: number }>();
  const cacheEntries = new Map<number, { hash: string; durationMs: number }>();

  for (const step of narratedSteps) {
    const hash = computeHash(step.text, voice);
    const fileName = `step-${step.index}.mp3`;
    const mp3Path = join(outDir, fileName);

    const srcPrefix = baseUrl ? `${baseUrl.replace(/\/$/, "")}/${scenarioId}` : `.`;
    const src = `${srcPrefix}/${fileName}`;

    if (isCached(existingCache, step.index, hash, voice) && (await fileExists(mp3Path))) {
      const durationMs = getCachedDuration(existingCache!, step.index);
      manifestEntries.set(step.index, { src, durationMs });
      cacheEntries.set(step.index, { hash, durationMs });
      stats.cached++;
      onLog(`    step ${step.index}: cached`);
      continue;
    }

    onLog(`    step ${step.index}: generating...`);
    const result = await provider.synthesize(step.text, { voice: voice || undefined });

    await writeFile(mp3Path, result.audio);
    manifestEntries.set(step.index, { src, durationMs: result.durationMs });
    cacheEntries.set(step.index, { hash, durationMs: result.durationMs });
    stats.generated++;
    onLog(`    step ${step.index}: ${result.durationMs}ms (${result.audio.length} bytes)`);
  }

  const manifest = buildRuntimeManifest(totalSteps, manifestEntries);
  await writeFile(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  const cache = buildCacheFile(voice, totalSteps, cacheEntries);
  await saveCache(outDir, cache);

  onLog(`\x1b[32m+\x1b[0m ${scenarioId}: ${stats.generated} generated, ${stats.cached} cached`);
  return stats;
}

/**
 * Generate narration audio for a scenario file or a directory of scenarios —
 * the pure orchestration behind `scenar narrate`. Resolves the TTS provider,
 * synthesizes per-step audio (incremental via a content-hash cache), writes each
 * scenario's manifest, and returns aggregate stats. No process/exit coupling.
 */
export async function runNarrate(options: RunNarrateOptions): Promise<NarrateResult> {
  const onLog = options.onLog ?? (() => {});
  const provider = await resolveProvider(options.tts ?? "echogarden");
  const resolved = resolve(options.target);
  const info = await stat(resolved);

  return info.isDirectory()
    ? narrateDirectory(resolved, options, provider, onLog)
    : narrateSingleFile(resolved, options, provider, onLog);
}

async function narrateSingleFile(
  filePath: string,
  options: RunNarrateOptions,
  provider: TtsProvider,
  onLog: (message: string) => void,
): Promise<NarrateResult> {
  const { steps, totalSteps } = await loadStepsFromFile(filePath);
  const narratedSteps = extractNarratedSteps(steps);
  const id = basename(dirname(filePath));

  if (narratedSteps.length === 0) {
    return {
      mode: "file",
      scenarios: [{ id, generated: 0, cached: 0, skipped: true }],
      totalGenerated: 0,
      totalCached: 0,
      totalSkipped: 1,
      errors: [],
    };
  }

  const outDir = options.out ?? join(dirname(filePath), "narration");
  const stats = await generateNarration({
    scenarioId: id,
    narratedSteps,
    totalSteps,
    outDir,
    voice: options.voice ?? "",
    baseUrl: options.baseUrl,
    provider,
    onLog,
  });

  return {
    mode: "file",
    scenarios: [{ id, generated: stats.generated, cached: stats.cached, skipped: false }],
    totalGenerated: stats.generated,
    totalCached: stats.cached,
    totalSkipped: 0,
    errors: [],
  };
}

async function narrateDirectory(
  dirPath: string,
  options: RunNarrateOptions,
  provider: TtsProvider,
  onLog: (message: string) => void,
): Promise<NarrateResult> {
  const scenarios = await discoverScenarios(dirPath);
  const result: NarratedScenario[] = [];
  const errors: Array<{ id: string; message: string }> = [];
  let totalGenerated = 0;
  let totalCached = 0;
  let totalSkipped = 0;

  if (scenarios.length > 0) {
    onLog(`Discovered ${scenarios.length} scenario(s)`);
  }

  for (const scenario of scenarios) {
    onLog(`  ${scenario.id}`);
    try {
      const steps = await loadStepsFromTs(scenario.stepsPath);
      const narratedSteps = extractNarratedSteps(steps);

      if (narratedSteps.length === 0) {
        onLog("    (no narration)");
        totalSkipped++;
        result.push({ id: scenario.id, generated: 0, cached: 0, skipped: true });
        continue;
      }

      const outDir = options.out
        ? join(options.out, scenario.id)
        : join(dirPath, scenario.id, "narration");

      const stats = await generateNarration({
        scenarioId: scenario.id,
        narratedSteps,
        totalSteps: steps.length,
        outDir,
        voice: options.voice ?? "",
        baseUrl: options.baseUrl,
        provider,
        onLog,
      });

      totalGenerated += stats.generated;
      totalCached += stats.cached;
      result.push({ id: scenario.id, generated: stats.generated, cached: stats.cached, skipped: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onLog(`    \x1b[31mfailed\x1b[0m: ${message}`);
      errors.push({ id: scenario.id, message });
    }
  }

  return { mode: "directory", scenarios: result, totalGenerated, totalCached, totalSkipped, errors };
}
