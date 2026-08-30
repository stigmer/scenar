import { Command } from "commander";
import { confirm } from "../util/confirm.js";
import { runPresenter } from "../presenter/run-presenter.js";
import type { HeygenEngineFlag } from "../presenter/heygen-client.js";

interface PresenterOptions {
  avatar?: string;
  engine: string;
  resolution: string;
  out?: string;
  baseUrl?: string;
  yes?: boolean;
}

const ENGINES = new Set<HeygenEngineFlag>(["iii", "iv"]);
const RESOLUTIONS = new Set(["720p", "1080p"]);

export function registerPresenterCommand(program: Command): void {
  program
    .command("presenter")
    .description(
      "Generate presenter avatar clips from narration audio (HeyGen).\n\n" +
        "For each step marked `presenter: true`, uploads the step's\n" +
        "narration audio, generates a lip-synced avatar clip, and writes\n" +
        "presenter/manifest.json beside the narration output. Run\n" +
        "'scenar narrate' first — clips are derived from narration audio.\n\n" +
        "This command calls a paid API: the batch estimate is printed and\n" +
        "confirmed before any generation (skip the prompt with --yes).\n" +
        "Requires HEYGEN_API_KEY.",
    )
    .argument("<file-or-dir>", "path to scenario file (.yaml/.ts) or directory")
    .option("--avatar <id>", "HeyGen avatar id (fallback: HEYGEN_AVATAR_ID env)")
    .option("--engine <engine>", "generation engine: iii or iv", "iii")
    .option("--resolution <tier>", "output resolution: 720p or 1080p", "720p")
    .option("--out <dir>", "output directory for clips")
    .option("--base-url <path>", "URL path prefix for src fields in manifest")
    .option("--yes", "skip the cost confirmation (CI / scripts)")
    .action(async (fileOrDir: string, options: PresenterOptions) => {
      try {
        if (!ENGINES.has(options.engine as HeygenEngineFlag)) {
          throw new Error(`Unknown engine '${options.engine}'. Use iii or iv.`);
        }
        if (!RESOLUTIONS.has(options.resolution)) {
          throw new Error(`Unknown resolution '${options.resolution}'. Use 720p or 1080p.`);
        }

        const result = await runPresenter({
          target: fileOrDir,
          avatar: options.avatar,
          engine: options.engine as HeygenEngineFlag,
          resolution: options.resolution,
          out: options.out,
          baseUrl: options.baseUrl,
          yes: options.yes,
          confirmImpl: confirm,
          onLog: (message) => process.stderr.write(`${message}\n`),
        });

        if (result.aborted) {
          process.exitCode = 1;
          return;
        }

        if (result.mode === "file") {
          const only = result.scenarios[0];
          if (only?.skipped) {
            process.stderr.write(
              "\x1b[33m!\x1b[0m No steps opt into the presenter (`presenter: true`). Nothing to generate.\n",
            );
          }
          if (result.totalFailed > 0) process.exitCode = 1;
          return;
        }

        // Directory mode: print the aggregate summary.
        if (result.scenarios.length === 0) {
          process.stderr.write("\x1b[33m!\x1b[0m No scenario directories with steps.ts found.\n");
          return;
        }
        const withPresenter = result.scenarios.filter((s) => !s.skipped).length;
        process.stderr.write("\n");
        process.stderr.write(`Scenarios with presenter steps: ${withPresenter}\n`);
        process.stderr.write(`Clips generated:                ${result.totalGenerated}\n`);
        process.stderr.write(`Clips cached:                   ${result.totalCached}\n`);
        process.stderr.write(`Scenarios skipped:              ${result.totalSkipped}\n`);

        if (result.totalFailed > 0 || result.errors.length > 0) {
          if (result.errors.length > 0) {
            process.stderr.write(`\n\x1b[31m${result.errors.length} scenario(s) failed:\x1b[0m\n`);
            for (const { id, message } of result.errors) {
              process.stderr.write(`  - ${id}: ${message}\n`);
            }
          }
          if (result.totalFailed > 0) {
            process.stderr.write(`\n\x1b[31m${result.totalFailed} clip(s) failed to generate.\x1b[0m\n`);
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
