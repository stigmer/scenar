import { Command } from "commander";
import { DEFAULT_VIEWPORT } from "../pack/viewport.js";
import { runPack } from "../pack/run-pack.js";

/** Default canonical viewport width (matches DemoViewport's default). */
const DEFAULT_WIDTH = DEFAULT_VIEWPORT.width;

/** Default shell height for the embed. */
const DEFAULT_SHELL_HEIGHT = DEFAULT_VIEWPORT.height;

interface PackOptions {
  out?: string;
  width?: string;
  shellHeight?: string;
  keepTemp?: boolean;
}

export function registerPackCommand(program: Command): void {
  program
    .command("pack")
    .description(
      "Bundle a scenario into a self-contained, hosted embed.\n\n" +
        "Accepts the same scenario directory as `render`\n" +
        "(steps.ts + an index.tsx that exports renderStep, plus an\n" +
        "optional .scenar/providers.tsx and narration/). Produces a static\n" +
        "bundle that boots ScenarioPlayer in the browser, ready for\n" +
        "`scenar serve` or `scenar publish`.\n\n" +
        "The bundle contains index.html, hashed JS/CSS, a scenario.json\n" +
        "descriptor, and a pack-manifest.json listing every file with its\n" +
        "lowercase-hex sha256 and content type. Output stays within the\n" +
        "deploy allowlist: HTML/JS/CSS/JSON, MP3 narration, raster images\n" +
        "(png/jpg/jpeg/gif/webp/avif), and woff2/woff fonts. SVG is not a\n" +
        "served type — inline it as a component or data URI.\n\n" +
        "Output defaults to ./<scenario-id>-bundle. Use --out to override.",
    )
    .argument("<dir>", "path to a scenario directory (must contain steps.ts)")
    .option("--out <path>", "output directory for the bundle")
    .option("--width <number>", `canonical viewport width in px (default: ${DEFAULT_WIDTH})`, String(DEFAULT_WIDTH))
    .option(
      "--shell-height <number>",
      `shell height in px (default: ${DEFAULT_SHELL_HEIGHT})`,
      String(DEFAULT_SHELL_HEIGHT),
    )
    .option("--keep-temp", "keep the generated entry directory for debugging")
    .action(async (dir: string, options: PackOptions) => {
      try {
        const result = await runPack({
          scenarioDir: dir,
          outDir: options.out,
          width: Number(options.width) || DEFAULT_WIDTH,
          shellHeight: Number(options.shellHeight) || DEFAULT_SHELL_HEIGHT,
          keepTemp: options.keepTemp,
          onLog: (message) => process.stderr.write(`${message}\n`),
        });

        process.stderr.write(
          `\n\x1b[32m✓\x1b[0m Packed ${result.manifest.files.length} files ` +
            `(${formatBytes(result.totalBytes)}) to ${result.outDir}\n`,
        );
        process.stderr.write(`  Next: scenar serve ${result.outDir}\n`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        process.stderr.write(`\x1b[31mError:\x1b[0m ${msg}\n`);
        process.exitCode = 1;
      }
    });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}
