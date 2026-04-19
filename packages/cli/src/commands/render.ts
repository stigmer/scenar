import { resolve, join } from "node:path";
import { stat, mkdir, access, writeFile, rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { Command } from "commander";
import { loadBundle, type CliBundle } from "../util/load-bundle.js";
import { generateRemotionEntry } from "../render/generate-entry.js";
import { resolveProvidersPath } from "../render/resolve-providers.js";
import { detectRenderExport } from "../render/detect-render-export.js";

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

      let tempDir: string | undefined;

      try {
        const bundle = await loadBundle(resolved);
        const scenarioId = bundle.id;
        const compositionId = options.compositionId ?? scenarioId;
        const outputPath = resolveOutputPath(options.out, scenarioId);

        const { entryPoint, generated } = await resolveEntryPoint({
          entryOption: options.entry,
          scenarioDir: resolved,
          scenarioId,
          compositionId,
          hasNarration: !!bundle.narrationManifest,
          fps,
          width,
          height,
        });
        tempDir = generated?.tempDir;

        const webpackOverride = options.webpackOverride
          ? await loadWebpackOverride(options.webpackOverride)
          : undefined;

        process.stderr.write(`Scenario: ${scenarioId}\n`);
        process.stderr.write(`Steps:    ${bundle.steps.length}\n`);
        process.stderr.write(
          `Audio:    ${bundle.narrationManifest ? "yes (manifest found)" : "none"}\n`,
        );
        process.stderr.write(`Entry:    ${generated ? "(auto-generated)" : entryPoint}\n`);
        if (generated?.providersPath) {
          process.stderr.write(`Providers: ${generated.providersPath}\n`);
        }
        if (webpackOverride) {
          process.stderr.write(`Webpack:  custom override loaded\n`);
        }
        process.stderr.write(`Output:   ${outputPath}\n`);
        process.stderr.write(`Config:   ${width}x${height} @ ${fps}fps\n\n`);

        await renderScenario({
          bundle,
          entryPoint,
          compositionId,
          outputPath,
          fps,
          width,
          height,
          webpackOverride,
        });

        process.stderr.write(`\n\x1b[32m✓\x1b[0m Video saved to ${outputPath}\n`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        process.stderr.write(`\x1b[31mError:\x1b[0m ${msg}\n`);
        process.exitCode = 1;
      } finally {
        if (tempDir) {
          await rm(tempDir, { recursive: true, force: true }).catch(() => {});
        }
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

interface EntryResolutionInput {
  entryOption: string | undefined;
  scenarioDir: string;
  scenarioId: string;
  compositionId: string;
  hasNarration: boolean;
  fps: number;
  width: number;
  height: number;
}

interface EntryResolutionResult {
  entryPoint: string;
  generated?: {
    tempDir: string;
    providersPath: string | null;
  };
}

async function resolveEntryPoint(
  input: EntryResolutionInput,
): Promise<EntryResolutionResult> {
  // Explicit --entry: use as-is, no generation.
  if (input.entryOption) {
    const resolved = resolve(input.entryOption);
    try {
      await access(resolved);
    } catch {
      throw new Error(`Remotion entry point not found: ${input.entryOption}`);
    }
    return { entryPoint: resolved };
  }

  // Auto-generate: detect renderStep export, find providers, write temp entry.
  const renderFilePath = await detectRenderExport(input.scenarioDir);
  const providersPath = await resolveProvidersPath(input.scenarioDir);

  const entrySource = generateRemotionEntry({
    scenarioDir: input.scenarioDir,
    renderFilePath,
    scenarioId: input.scenarioId,
    hasNarration: input.hasNarration,
    providersPath,
    fps: input.fps,
    width: input.width,
    height: input.height,
    compositionId: input.compositionId,
  });

  // Write the entry inside the scenario directory so webpack's standard
  // node_modules resolution walks up from here into the consumer project.
  // A /tmp/ location would fail because no node_modules exist there.
  const tempDir = join(input.scenarioDir, ".scenar-render");
  await mkdir(tempDir, { recursive: true });

  const entryPath = join(tempDir, "index.tsx");
  await writeFile(entryPath, entrySource, "utf-8");

  return {
    entryPoint: entryPath,
    generated: { tempDir, providersPath },
  };
}

// ---------------------------------------------------------------------------
// Webpack override loading
// ---------------------------------------------------------------------------

async function loadWebpackOverride(
  overridePath: string,
): Promise<(config: unknown) => unknown> {
  const resolved = resolve(overridePath);

  try {
    await access(resolved);
  } catch {
    throw new Error(`Webpack override file not found: ${overridePath}`);
  }

  let mod: Record<string, unknown>;
  try {
    mod = await import(pathToFileURL(resolved).href) as Record<string, unknown>;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to import webpack override from ${overridePath}:\n${detail}`,
    );
  }

  const override = (mod.default ?? mod.webpackOverride) as unknown;
  if (typeof override !== "function") {
    throw new Error(
      `${overridePath} does not export a webpack override function.\n\n` +
      "Expected a default export or named 'webpackOverride' export:\n\n" +
      '  import type { WebpackOverrideFn } from "@remotion/bundler";\n\n' +
      "  const webpackOverride: WebpackOverrideFn = (config) => ({\n" +
      "    ...config,\n" +
      "    // your overrides\n" +
      "  });\n\n" +
      "  export default webpackOverride;\n",
    );
  }

  return override as (config: unknown) => unknown;
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
  webpackOverride?: (config: unknown) => unknown;
}

async function renderScenario(config: RenderConfig): Promise<void> {
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

  const bundleOptions: Record<string, unknown> = {
    entryPoint: config.entryPoint,
  };
  if (config.webpackOverride) {
    bundleOptions.webpackOverride = config.webpackOverride;
  }
  const serveUrl = await (bundler.bundle as (opts: Record<string, unknown>) => Promise<string>)(
    bundleOptions,
  );

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
