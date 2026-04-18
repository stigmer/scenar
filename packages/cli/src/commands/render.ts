import { resolve, join } from "node:path";
import { stat, mkdir, access } from "node:fs/promises";
import { Command } from "commander";
import { loadBundle, type CliBundle } from "../util/load-bundle.js";

interface RenderOptions {
  out?: string;
  fps?: string;
  width?: string;
  height?: string;
  compositionId?: string;
  entry?: string;
}

export function registerRenderCommand(program: Command): void {
  program
    .command("render")
    .description(
      "Render a scenario as an MP4 video using Remotion.\n\n" +
      "Accepts a scenario directory containing steps.ts and an optional\n" +
      "narration/ subfolder with manifest.json + audio clips.\n\n" +
      "Output defaults to ./<scenario-id>.mp4 in the current working\n" +
      "directory. Use --out to write to a different path.",
    )
    .argument("<dir>", "path to a scenario directory (must contain steps.ts)")
    .option("--out <path>", "output file path or directory for the MP4")
    .option("--fps <number>", "frames per second (default: 30)", "30")
    .option("--width <number>", "video width in pixels (default: 1920)", "1920")
    .option("--height <number>", "video height in pixels (default: 1080)", "1080")
    .option("--composition-id <id>", "Remotion composition ID to render")
    .option("--entry <path>", "path to a Remotion entry file (Root.tsx)")
    .action(async (dir: string, options: RenderOptions) => {
      const resolved = resolve(dir);

      let info;
      try {
        info = await stat(resolved);
      } catch {
        process.stderr.write(`\x1b[31mError:\x1b[0m ${dir} does not exist.\n`);
        process.exitCode = 1;
        return;
      }

      if (!info.isDirectory()) {
        process.stderr.write(
          `\x1b[31mError:\x1b[0m ${dir} is not a directory.\n` +
          "The render command requires a scenario directory (with steps.ts).\n",
        );
        process.exitCode = 1;
        return;
      }

      const fps = Number(options.fps) || 30;
      const width = Number(options.width) || 1920;
      const height = Number(options.height) || 1080;

      try {
        const bundle = await loadBundle(resolved);
        const scenarioId = bundle.id;
        const outputPath = resolveOutputPath(options.out, scenarioId);
        const entryPoint = await resolveEntryPoint(options.entry);

        process.stderr.write(`Scenario: ${scenarioId}\n`);
        process.stderr.write(`Steps:    ${bundle.steps.length}\n`);
        process.stderr.write(
          `Audio:    ${bundle.narrationManifest ? "yes (manifest found)" : "none"}\n`,
        );
        process.stderr.write(`Entry:    ${entryPoint}\n`);
        process.stderr.write(`Output:   ${outputPath}\n`);
        process.stderr.write(`Config:   ${width}x${height} @ ${fps}fps\n\n`);

        await renderScenario({
          bundle,
          entryPoint,
          compositionId: options.compositionId ?? scenarioId,
          outputPath,
          fps,
          width,
          height,
        });

        process.stderr.write(`\n\x1b[32m✓\x1b[0m Video saved to ${outputPath}\n`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        process.stderr.write(`\x1b[31mError:\x1b[0m ${msg}\n`);
        process.exitCode = 1;
      }
    });
}

// ---------------------------------------------------------------------------
// Output path resolution
// ---------------------------------------------------------------------------

function resolveOutputPath(outOption: string | undefined, scenarioId: string): string {
  if (!outOption) {
    return resolve(`./${scenarioId}.mp4`);
  }
  if (outOption.endsWith(".mp4")) {
    return resolve(outOption);
  }
  return resolve(join(outOption, `${scenarioId}.mp4`));
}

// ---------------------------------------------------------------------------
// Entry point resolution
// ---------------------------------------------------------------------------

async function resolveEntryPoint(entryOption: string | undefined): Promise<string> {
  if (entryOption) {
    const resolved = resolve(entryOption);
    try {
      await access(resolved);
    } catch {
      throw new Error(`Remotion entry point not found: ${entryOption}`);
    }
    return resolved;
  }

  const candidates = [
    resolve("remotion/index.tsx"),
    resolve("remotion/index.ts"),
    resolve("src/remotion/index.tsx"),
    resolve("src/remotion/index.ts"),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try next.
    }
  }

  throw new Error(
    "No Remotion entry point found.\n\n" +
    "Create a remotion/index.tsx that exports your Remotion Root component,\n" +
    "or use --entry to specify a custom path.\n\n" +
    "Example remotion/index.tsx:\n\n" +
    '  import { Composition } from "remotion";\n' +
    '  import { ScenarioComposition, calculateScenarioTimeline } from "@scenar/remotion";\n' +
    "  import { myBundle } from \"../scenarios/my-demo/bundle\";\n\n" +
    "  export const RemotionRoot = () => (\n" +
    "    <Composition\n" +
    '      id="my-demo"\n' +
    "      component={() => (\n" +
    "        <ScenarioComposition bundle={myBundle}>\n" +
    "          {(data) => <MyView data={data} />}\n" +
    "        </ScenarioComposition>\n" +
    "      )}\n" +
    "      fps={30}\n" +
    "      width={1920}\n" +
    "      height={1080}\n" +
    "      durationInFrames={\n" +
    "        calculateScenarioTimeline(myBundle.steps, myBundle.narrationManifest, 30)\n" +
    "          .durationInFrames\n" +
    "      }\n" +
    "    />\n" +
    "  );\n",
  );
}

// ---------------------------------------------------------------------------
// Render orchestration
// ---------------------------------------------------------------------------

interface RenderConfig {
  bundle: CliBundle;
  entryPoint: string;
  compositionId: string;
  outputPath: string;
  fps: number;
  width: number;
  height: number;
}

async function renderScenario(config: RenderConfig): Promise<void> {
  // Dynamic imports — these are optional peer deps.
  const bundler = await import("@remotion/bundler").catch(() => {
    throw new Error(
      "Could not load @remotion/bundler.\n" +
      "Install it: pnpm add @remotion/bundler@4.0.448",
    );
  });

  const renderer = await import("@remotion/renderer").catch(() => {
    throw new Error(
      "Could not load @remotion/renderer.\n" +
      "Install it: pnpm add @remotion/renderer@4.0.448",
    );
  });

  process.stderr.write("Bundling Remotion project...\n");
  const serveUrl = await bundler.bundle({ entryPoint: config.entryPoint });

  process.stderr.write(`Selecting composition: ${config.compositionId}\n`);
  const composition = await renderer.selectComposition({
    serveUrl,
    id: config.compositionId,
  });

  process.stderr.write(
    `Composition: ${composition.width}x${composition.height} @ ${composition.fps}fps, ` +
    `${composition.durationInFrames} frames ` +
    `(${(composition.durationInFrames / composition.fps).toFixed(1)}s)\n`,
  );

  const outDir = resolve(config.outputPath, "..");
  await mkdir(outDir, { recursive: true });

  process.stderr.write("Rendering...\n");
  await renderer.renderMedia({
    composition,
    serveUrl,
    codec: "h264" as const,
    outputLocation: config.outputPath,
    onProgress: ({ progress }) => {
      const pct = Math.round(progress * 100);
      process.stderr.write(`\r  Progress: ${pct}%`);
    },
  });

  process.stderr.write("\n");
}
