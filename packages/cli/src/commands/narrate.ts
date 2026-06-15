import { Command } from "commander";
import { runNarrate } from "../narrate/run-narrate.js";

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
      try {
        const result = await runNarrate({
          target: fileOrDir,
          tts: options.tts,
          out: options.out,
          voice: options.voice,
          baseUrl: options.baseUrl,
          onLog: (message) => process.stderr.write(`${message}\n`),
        });

        if (result.mode === "file") {
          const only = result.scenarios[0];
          if (only?.skipped) {
            process.stderr.write(
              "\x1b[33m!\x1b[0m No steps contain narration text. Nothing to generate.\n",
            );
          }
          return;
        }

        // Directory mode: print the aggregate summary.
        if (result.scenarios.length === 0) {
          process.stderr.write("\x1b[33m!\x1b[0m No scenario directories with steps.ts found.\n");
          return;
        }
        const withNarration = result.scenarios.filter((s) => !s.skipped).length;
        process.stderr.write("\n");
        process.stderr.write(`Scenarios with narration: ${withNarration}\n`);
        process.stderr.write(`Audio files generated:    ${result.totalGenerated}\n`);
        process.stderr.write(`Audio files cached:       ${result.totalCached}\n`);
        process.stderr.write(`Scenarios skipped:        ${result.totalSkipped}\n`);

        if (result.errors.length > 0) {
          process.stderr.write(`\n\x1b[31m${result.errors.length} scenario(s) failed:\x1b[0m\n`);
          for (const { id, message } of result.errors) {
            process.stderr.write(`  - ${id}: ${message}\n`);
          }
          process.exitCode = 1;
        } else {
          process.stderr.write("\nDone\n");
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        process.stderr.write(`\x1b[31mError:\x1b[0m ${msg}\n`);
        process.exitCode = 1;
      }
    });
}
