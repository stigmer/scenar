import { mkdir, writeFile, stat } from "node:fs/promises";
import { join, resolve, extname, basename, dirname } from "node:path";
import { Command } from "commander";
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

interface NarrateOptions {
  tts: string;
  out?: string;
  voice?: string;
  baseUrl?: string;
}

export function registerNarrateCommand(program: Command): void {
  program
    .command("narrate")
    .description(
      "Generate narration audio from scenario files.\n\n" +
      "Accepts a YAML file, a TypeScript steps file, or a directory\n" +
      "containing scenario subdirectories (each with a steps.ts).",
    )
    .argument("<file-or-dir>", "path to scenario file (.yaml/.ts) or directory")
    .option("--tts <provider>", "TTS provider: echogarden, edge-tts, or openai", "echogarden")
    .option("--out <dir>", "output directory for audio files")
    .option("--voice <voice>", "voice name (provider-specific)")
    .option("--base-url <path>", "URL path prefix for src fields in manifest")
    .action(async (fileOrDir: string, options: NarrateOptions) => {
      const provider = await resolveProvider(options.tts);
      const resolved = resolve(fileOrDir);
      const info = await stat(resolved);

      if (info.isDirectory()) {
        await runNarrateDirectory(resolved, options, provider);
      } else {
        await runNarrateSingleFile(resolved, options, provider);
      }
    });
}

// ---------------------------------------------------------------------------
// Step extraction
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Runtime manifest (matches @scenar/core NarrationManifest)
// ---------------------------------------------------------------------------

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
  const steps: (RuntimeManifestEntry | null)[] = Array.from(
    { length: totalSteps },
    () => null,
  );
  for (const [idx, entry] of entries) {
    steps[idx] = entry;
  }
  return { steps };
}

// ---------------------------------------------------------------------------
// Single-file narration
// ---------------------------------------------------------------------------

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

async function runNarrateSingleFile(
  filePath: string,
  options: NarrateOptions,
  provider: TtsProvider,
): Promise<void> {
  const { steps, totalSteps } = await loadStepsFromFile(filePath);
  const narratedSteps = extractNarratedSteps(steps);

  if (narratedSteps.length === 0) {
    process.stderr.write("\x1b[33m!\x1b[0m No steps contain narration text. Nothing to generate.\n");
    return;
  }

  const outDir = options.out ?? join(dirname(filePath), "narration");
  const voice = options.voice ?? "";

  await generateNarration({
    scenarioId: basename(dirname(filePath)),
    narratedSteps,
    totalSteps,
    outDir,
    voice,
    baseUrl: options.baseUrl,
    provider,
  });
}

// ---------------------------------------------------------------------------
// Directory-mode narration
// ---------------------------------------------------------------------------

async function runNarrateDirectory(
  dirPath: string,
  options: NarrateOptions,
  provider: TtsProvider,
): Promise<void> {
  const scenarios = await discoverScenarios(dirPath);

  if (scenarios.length === 0) {
    process.stderr.write("\x1b[33m!\x1b[0m No scenario directories with steps.ts found.\n");
    return;
  }

  process.stderr.write(`Discovered ${scenarios.length} scenario(s)\n\n`);

  let totalGenerated = 0;
  let totalCached = 0;
  let totalSkipped = 0;
  let scenariosWithNarration = 0;
  const errors: Array<{ id: string; error: unknown }> = [];

  for (const scenario of scenarios) {
    process.stderr.write(`  ${scenario.id}\n`);
    try {
      const steps = await loadStepsFromTs(scenario.stepsPath);
      const narratedSteps = extractNarratedSteps(steps);

      if (narratedSteps.length === 0) {
        process.stderr.write("    (no narration)\n");
        totalSkipped++;
        continue;
      }

      scenariosWithNarration++;

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
      });

      totalGenerated += stats.generated;
      totalCached += stats.cached;
    } catch (error) {
      process.stderr.write(`    \x1b[31mfailed\x1b[0m: ${error}\n`);
      errors.push({ id: scenario.id, error });
    }
  }

  process.stderr.write("\n");
  process.stderr.write(`Scenarios with narration: ${scenariosWithNarration}\n`);
  process.stderr.write(`Audio files generated:    ${totalGenerated}\n`);
  process.stderr.write(`Audio files cached:       ${totalCached}\n`);
  process.stderr.write(`Scenarios skipped:        ${totalSkipped}\n`);

  if (errors.length > 0) {
    process.stderr.write(`\n\x1b[31m${errors.length} scenario(s) failed:\x1b[0m\n`);
    for (const { id, error } of errors) {
      process.stderr.write(`  - ${id}: ${error}\n`);
    }
    process.exitCode = 1;
  } else {
    process.stderr.write("\nDone\n");
  }
}

// ---------------------------------------------------------------------------
// Core generation logic (shared by single-file and directory modes)
// ---------------------------------------------------------------------------

interface GenerateOptions {
  scenarioId: string;
  narratedSteps: StepWithNarration[];
  totalSteps: number;
  outDir: string;
  voice: string;
  baseUrl?: string;
  provider: TtsProvider;
}

interface GenerateStats {
  generated: number;
  cached: number;
}

async function generateNarration(opts: GenerateOptions): Promise<GenerateStats> {
  const { scenarioId, narratedSteps, totalSteps, outDir, voice, baseUrl, provider } = opts;

  await mkdir(outDir, { recursive: true });

  const existingCache = await loadCache(outDir);
  const stats: GenerateStats = { generated: 0, cached: 0 };
  const manifestEntries = new Map<number, { src: string; durationMs: number }>();
  const cacheEntries = new Map<number, { hash: string; durationMs: number }>();

  for (const step of narratedSteps) {
    const hash = computeHash(step.text, voice);
    const fileName = `step-${step.index}.mp3`;
    const mp3Path = join(outDir, fileName);

    const srcPrefix = baseUrl
      ? `${baseUrl.replace(/\/$/, "")}/${scenarioId}`
      : `.`;
    const src = `${srcPrefix}/${fileName}`;

    if (isCached(existingCache, step.index, hash, voice) && await fileExists(mp3Path)) {
      const durationMs = getCachedDuration(existingCache!, step.index);
      manifestEntries.set(step.index, { src, durationMs });
      cacheEntries.set(step.index, { hash, durationMs });
      stats.cached++;
      process.stderr.write(`    step ${step.index}: cached\n`);
      continue;
    }

    process.stderr.write(`    step ${step.index}: generating...\n`);
    const result = await provider.synthesize(step.text, {
      voice: voice || undefined,
    });

    await writeFile(mp3Path, result.audio);
    manifestEntries.set(step.index, { src, durationMs: result.durationMs });
    cacheEntries.set(step.index, { hash, durationMs: result.durationMs });
    stats.generated++;
    process.stderr.write(`    step ${step.index}: ${result.durationMs}ms (${result.audio.length} bytes)\n`);
  }

  const manifest = buildRuntimeManifest(totalSteps, manifestEntries);
  await writeFile(
    join(outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );

  const cache = buildCacheFile(voice, totalSteps, cacheEntries);
  await saveCache(outDir, cache);

  process.stderr.write(
    `\x1b[32m+\x1b[0m ${scenarioId}: ${stats.generated} generated, ${stats.cached} cached\n`,
  );

  return stats;
}
