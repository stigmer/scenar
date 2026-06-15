import { resolve, join, basename } from "node:path";
import { stat, mkdir, writeFile, rm, readdir, copyFile, access } from "node:fs/promises";
import { detectRenderExport } from "../render/detect-render-export.js";
import { resolveProvidersPath } from "../render/resolve-providers.js";
import { generateEmbedEntry, generateEmbedHtml } from "./generate-embed-entry.js";
import { runViteBuild } from "./build.js";
import { copyEmbedLoader } from "./embed-loader.js";
import {
  buildPackManifest,
  writePackManifest,
  writeScenarioJson,
  verifyManifestFilesExist,
  type PackManifest,
} from "./pack-manifest.js";
import { DEFAULT_VIEWPORT } from "./viewport.js";

/** Generator version stamped into scenario.json (kept in sync with the CLI). */
const PACK_GENERATOR_VERSION = "0.0.1";

/** Options for {@link runPack}. Paths may be relative; they are resolved here. */
export interface RunPackOptions {
  /** Path to a scenario directory (must contain steps.ts + a renderStep export). */
  readonly scenarioDir: string;
  /** Output directory for the bundle (default: ./<scenario-id>-bundle). */
  readonly outDir?: string;
  /** Canonical viewport width in px (default: {@link DEFAULT_VIEWPORT}.width). */
  readonly width?: number;
  /** Shell/container height in px (default: {@link DEFAULT_VIEWPORT}.height). */
  readonly shellHeight?: number;
  /** Keep the generated entry directory for debugging (default: false). */
  readonly keepTemp?: boolean;
  /** Progress sink for mid-operation messages. */
  readonly onLog?: (message: string) => void;
}

/** The outcome of a successful pack. */
export interface PackResult {
  readonly scenarioId: string;
  readonly outDir: string;
  readonly renderFilePath: string;
  readonly providersPath: string | null;
  readonly hasNarration: boolean;
  readonly manifest: PackManifest;
  readonly totalBytes: number;
}

/**
 * Bundle a scenario directory into a self-contained, hosted embed — the pure
 * orchestration behind `scenar pack`, with no process/exit coupling so both the
 * CLI command and the MCP server can call it. Throws on any failure (invalid
 * directory, bundler error, allowlist violation); the caller formats it.
 */
export async function runPack(options: RunPackOptions): Promise<PackResult> {
  const onLog = options.onLog ?? (() => {});
  const scenarioDir = resolve(options.scenarioDir);

  const info = await stat(scenarioDir).catch(() => null);
  if (!info) {
    throw new Error(`${options.scenarioDir} does not exist.`);
  }
  if (!info.isDirectory()) {
    throw new Error(
      `${options.scenarioDir} is not a directory. ` +
        "The pack command requires a scenario directory (with steps.ts).",
    );
  }

  const scenarioId = basename(scenarioDir);
  const outDir = options.outDir ? resolve(options.outDir) : resolve(`./${scenarioId}-bundle`);
  const width = options.width ?? DEFAULT_VIEWPORT.width;
  const shellHeight = options.shellHeight ?? DEFAULT_VIEWPORT.height;

  // The entry must live inside the scenario directory so the bundler's
  // node_modules resolution walks up into the consumer project.
  const tempDir = join(scenarioDir, ".scenar-pack");

  try {
    const renderFilePath = await detectRenderExport(scenarioDir);
    const providersPath = await resolveProvidersPath(scenarioDir);
    const hasNarration = await fileExists(join(scenarioDir, "narration", "manifest.json"));

    onLog(`Scenario:  ${scenarioId}`);
    onLog(`Render:    ${renderFilePath}`);
    onLog(`Providers: ${providersPath ?? "none"}`);
    onLog(`Narration: ${hasNarration ? "yes (manifest found)" : "none"}`);
    onLog(`Output:    ${outDir}`);

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
    onLog("Bundling embed with Vite...");
    await runViteBuild({ root: tempDir, outDir, entryHtmlPath });

    // 3. Copy the narration manifest + audio. The embed fetches
    //    ./narration/manifest.json at runtime and resolves each clip's
    //    relative src against it, so both must ship in the bundle.
    if (hasNarration) {
      await copyNarration(scenarioDir, outDir);
    }

    // 4. Write the required scenario.json descriptor, recording the canonical
    //    viewport baked into the bundle so `deploy`/`serve`/`publish` can derive
    //    a correctly-proportioned embed snippet (DD-004).
    await writeScenarioJson(outDir, scenarioId, PACK_GENERATOR_VERSION, {
      width,
      height: shellHeight,
    });

    // 4b. Copy the optional <scenar-embed> loader into the bundle as embed.js
    //     (sibling of index.html), so the enhanced snippet works on any static
    //     host (GitHub Pages, `serve`, the edge) with no extra setup. It lands
    //     before the manifest pass below so it ships as a first-class bundle file.
    await copyEmbedLoader(outDir);

    // 5. Compute + write the deploy-facing pack manifest (validates the bundle
    //    against the backend allowlist; throws on any violation).
    const manifest = await buildPackManifest(outDir, scenarioId);
    await verifyManifestFilesExist(outDir, manifest);
    await writePackManifest(outDir, manifest);

    const totalBytes = manifest.files.reduce((sum, f) => sum + f.sizeBytes, 0);
    return { scenarioId, outDir, renderFilePath, providersPath, hasNarration, manifest, totalBytes };
  } finally {
    if (!options.keepTemp) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

/**
 * Copy the narration manifest and every *.mp3 from <scenarioDir>/narration into
 * <outDir>/narration. The manifest is the runtime index the embed fetches; the
 * mp3s are the clips it references by relative src.
 */
async function copyNarration(scenarioDir: string, outDir: string): Promise<void> {
  const srcDir = join(scenarioDir, "narration");
  const destDir = join(outDir, "narration");
  await mkdir(destDir, { recursive: true });
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const name = entry.name.toLowerCase();
    if (name === "manifest.json" || name.endsWith(".mp3")) {
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
