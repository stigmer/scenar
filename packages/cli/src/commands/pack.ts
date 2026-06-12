import { resolve, join, basename } from "node:path";
import { stat, mkdir, writeFile, rm, readdir, copyFile, access } from "node:fs/promises";
import { Command } from "commander";
import { detectRenderExport } from "../render/detect-render-export.js";
import { resolveProvidersPath } from "../render/resolve-providers.js";
import { generateEmbedEntry, generateEmbedHtml } from "../pack/generate-embed-entry.js";
import { runViteBuild } from "../pack/build.js";
import {
  buildPackManifest,
  writePackManifest,
  writeScenarioJson,
  verifyManifestFilesExist,
} from "../pack/pack-manifest.js";

/** Generator version stamped into scenario.json (kept in sync with the CLI). */
const PACK_GENERATOR_VERSION = "0.0.1";

/** Default canonical viewport width (matches DemoViewport's default). */
const DEFAULT_WIDTH = 896;

/** Default shell height for the embed. */
const DEFAULT_SHELL_HEIGHT = 480;

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
        "Accepts the same scenario directory as `render`/`preview`\n" +
        "(steps.ts + an index.tsx that exports renderStep, plus an\n" +
        "optional .scenar/providers.tsx and narration/). Produces a static\n" +
        "bundle that boots ScenarioPlayer in the browser, ready for\n" +
        "`scenar deploy`.\n\n" +
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
      const scenarioDir = resolve(dir);

      let info;
      try {
        info = await stat(scenarioDir);
      } catch {
        process.stderr.write(`\x1b[31mError:\x1b[0m ${dir} does not exist.\n`);
        process.exitCode = 1;
        return;
      }
      if (!info.isDirectory()) {
        process.stderr.write(
          `\x1b[31mError:\x1b[0m ${dir} is not a directory.\n` +
            "The pack command requires a scenario directory (with steps.ts).\n",
        );
        process.exitCode = 1;
        return;
      }

      const scenarioId = basename(scenarioDir);
      const outDir = options.out ? resolve(options.out) : resolve(`./${scenarioId}-bundle`);
      const width = Number(options.width) || DEFAULT_WIDTH;
      const shellHeight = Number(options.shellHeight) || DEFAULT_SHELL_HEIGHT;

      // The entry must live inside the scenario directory so the bundler's
      // node_modules resolution walks up into the consumer project.
      const tempDir = join(scenarioDir, ".scenar-pack");

      try {
        const renderFilePath = await detectRenderExport(scenarioDir);
        const providersPath = await resolveProvidersPath(scenarioDir);
        const hasNarration = await fileExists(join(scenarioDir, "narration", "manifest.json"));

        process.stderr.write(`Scenario:  ${scenarioId}\n`);
        process.stderr.write(`Render:    ${renderFilePath}\n`);
        process.stderr.write(`Providers: ${providersPath ?? "none"}\n`);
        process.stderr.write(`Narration: ${hasNarration ? "yes (manifest found)" : "none"}\n`);
        process.stderr.write(`Output:    ${outDir}\n\n`);

        // 1. Generate the browser entry + index.html into the temp dir.
        const entrySource = generateEmbedEntry({
          scenarioDir,
          renderFilePath,
          scenarioId,
          hasNarration,
          providersPath,
          canonicalWidth: width,
          shellHeight,
        });
        await mkdir(tempDir, { recursive: true });
        const entryFileName = "entry.tsx";
        const entryHtmlPath = join(tempDir, "index.html");
        await writeFile(join(tempDir, entryFileName), entrySource, "utf-8");
        await writeFile(entryHtmlPath, generateEmbedHtml(scenarioId, entryFileName), "utf-8");

        // 2. Build the static bundle with Vite.
        process.stderr.write("Bundling embed with Vite...\n");
        await runViteBuild({ root: tempDir, outDir, entryHtmlPath });

        // 3. Copy narration audio (the manifest timing is baked into the JS,
        //    but the player fetches each clip by its relative src at runtime).
        if (hasNarration) {
          await copyNarrationAudio(scenarioDir, outDir);
        }

        // 4. Write the required scenario.json descriptor at the bundle root.
        await writeScenarioJson(outDir, scenarioId, PACK_GENERATOR_VERSION);

        // 5. Compute + write the deploy-facing pack manifest (validates the
        //    bundle against the backend allowlist; throws on any violation).
        const manifest = await buildPackManifest(outDir, scenarioId);
        await verifyManifestFilesExist(outDir, manifest);
        await writePackManifest(outDir, manifest);

        const totalBytes = manifest.files.reduce((sum, f) => sum + f.sizeBytes, 0);
        process.stderr.write(
          `\n\x1b[32m✓\x1b[0m Packed ${manifest.files.length} files (${formatBytes(totalBytes)}) to ${outDir}\n`,
        );
        process.stderr.write(`  Next: scenar deploy ${outDir}\n`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        process.stderr.write(`\x1b[31mError:\x1b[0m ${msg}\n`);
        process.exitCode = 1;
      } finally {
        if (!options.keepTemp) {
          await rm(tempDir, { recursive: true, force: true }).catch(() => {});
        }
      }
    });
}

/** Copy every *.mp3 from <scenarioDir>/narration into <outDir>/narration. */
async function copyNarrationAudio(scenarioDir: string, outDir: string): Promise<void> {
  const srcDir = join(scenarioDir, "narration");
  const destDir = join(outDir, "narration");
  await mkdir(destDir, { recursive: true });
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".mp3")) {
      await copyFile(join(srcDir, entry.name), join(destDir, entry.name));
    }
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}
