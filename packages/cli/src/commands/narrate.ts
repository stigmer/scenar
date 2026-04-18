import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Command } from "commander";
import { loadScenarioYaml } from "../util/load-yaml.js";
import { validateScenario } from "../validate/scenario-validator.js";
import { resolveProvider } from "../tts/resolve-provider.js";
import type { NarrationManifest, NarrationManifestStep, TtsProvider } from "../tts/types.js";

interface NarrateOptions {
  tts: string;
  out: string;
  voice?: string;
}

export function registerNarrateCommand(program: Command): void {
  program
    .command("narrate")
    .description("Generate narration audio from a scenario YAML file.")
    .argument("<file>", "path to scenario YAML file")
    .option("--tts <provider>", "TTS provider: echogarden (default) or openai", "echogarden")
    .option("--out <dir>", "output directory for audio files", "./narration")
    .option("--voice <voice>", "voice name (provider-specific)")
    .action(async (file: string, options: NarrateOptions) => {
      const provider = await resolveProvider(options.tts);
      await runNarrate(file, options, provider);
    });
}

interface StepWithNarration {
  index: number;
  text: string;
}

/**
 * Core narration logic, separated from provider resolution for testability.
 * The command handler resolves the provider, then delegates here.
 */
export async function runNarrate(
  file: string,
  options: NarrateOptions,
  provider: TtsProvider,
): Promise<void> {
  const scenario = await loadScenarioYaml(file);
  const validation = validateScenario(scenario);

  if (!validation.valid) {
    process.stderr.write(`\x1b[31m✗\x1b[0m Scenario has ${validation.errors.length} error(s). Run 'scenar validate ${file}' for details.\n`);
    process.exitCode = 1;
    return;
  }

  const steps = (scenario as Record<string, unknown>)["steps"] as Record<string, unknown>[] | undefined;
  if (!steps) {
    process.stderr.write("\x1b[31m✗\x1b[0m No steps found in scenario.\n");
    process.exitCode = 1;
    return;
  }

  const narratedSteps: StepWithNarration[] = [];
  for (let i = 0; i < steps.length; i++) {
    const text = steps[i]!["narrationText"];
    if (typeof text === "string" && text.length > 0) {
      narratedSteps.push({ index: i, text });
    }
  }

  if (narratedSteps.length === 0) {
    process.stderr.write("\x1b[33m⚠\x1b[0m No steps contain narration text. Nothing to generate.\n");
    return;
  }

  await mkdir(options.out, { recursive: true });

  const manifestSteps: NarrationManifestStep[] = [];

  for (let i = 0; i < narratedSteps.length; i++) {
    const step = narratedSteps[i]!;
    const fileName = `step-${step.index}.mp3`;
    const outputPath = join(options.out, fileName);

    process.stderr.write(
      `  [${i + 1}/${narratedSteps.length}] Generating audio for step ${step.index}...\n`,
    );

    const result = await provider.synthesize(step.text, {
      voice: options.voice,
    });

    await writeFile(outputPath, result.audio);

    manifestSteps.push({
      index: step.index,
      file: fileName,
      durationMs: result.durationMs,
      text: step.text,
    });
  }

  const manifest: NarrationManifest = {
    generatedAt: new Date().toISOString(),
    ttsProvider: provider.name,
    steps: manifestSteps,
  };

  const manifestPath = join(options.out, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

  process.stderr.write(
    `\n\x1b[32m✓\x1b[0m Generated ${manifestSteps.length} audio file(s) in ${options.out}/\n`,
  );
}
