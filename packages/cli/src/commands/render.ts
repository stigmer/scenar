import { Command } from "commander";
import { runRender } from "../render/run-render.js";

interface RenderOptions {
  out?: string;
  fps?: string;
  width?: string;
  height?: string;
  compositionId?: string;
  entry?: string;
  webpackOverride?: string;
}

export function registerRenderCommand(program: Command): void {
  program
    .command("render")
    .description(
      "Render a scenario as an MP4 video using Remotion.\n\n" +
        "Accepts a scenario directory containing steps.ts and an optional\n" +
        "narration/ subfolder with manifest.json + audio clips.\n\n" +
        "When the scenario directory contains an index.tsx that exports a\n" +
        "renderStep function, the CLI auto-generates the Remotion entry\n" +
        "point — no remotion/ directory or bundle.ts needed.\n\n" +
        "Output defaults to ./<scenario-id>.mp4 in the current working\n" +
        "directory. Use --out to write to a different path.",
    )
    .argument("<dir>", "path to a scenario directory (must contain steps.ts)")
    .option("--out <path>", "output file path or directory for the MP4")
    .option("--fps <number>", "frames per second (default: 30)", "30")
    .option("--width <number>", "video width in pixels (default: 1920)", "1920")
    .option("--height <number>", "video height in pixels (default: 1080)", "1080")
    .option("--composition-id <id>", "Remotion composition ID to render")
    .option("--entry <path>", "path to a custom Remotion entry file")
    .option(
      "--webpack-override <path>",
      "path to a module that default-exports a Remotion WebpackOverrideFn",
    )
    .action(async (dir: string, options: RenderOptions) => {
      try {
        const result = await runRender({
          scenarioDir: dir,
          out: options.out,
          fps: Number(options.fps) || 30,
          width: Number(options.width) || 1920,
          height: Number(options.height) || 1080,
          compositionId: options.compositionId,
          entry: options.entry,
          webpackOverride: options.webpackOverride,
          onLog: (message) => process.stderr.write(`${message}\n`),
        });

        process.stderr.write(`\n\x1b[32m✓\x1b[0m Video saved to ${result.outputPath}\n`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        process.stderr.write(`\x1b[31mError:\x1b[0m ${msg}\n`);
        process.exitCode = 1;
      }
    });
}
