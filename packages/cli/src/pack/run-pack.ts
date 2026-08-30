import { resolve, join, basename, dirname } from "node:path";
import { stat, mkdir, writeFile, rm, readdir, copyFile, access } from "node:fs/promises";
import { detectRenderExport } from "../render/detect-render-export.js";
import { resolveProvidersPath } from "../render/resolve-providers.js";
import type { AuthoredSoundtrack, AuthoredTitleCards } from "../util/load-ts.js";
import {
  SFX_DEST_PATHS,
  resolveMusicAsset,
  resolveSfxAssetPaths,
} from "../util/soundtrack-assets.js";
import { resolveLogoAsset } from "../util/scenario-assets.js";
import { generateEmbedEntry, generateEmbedHtml } from "./generate-embed-entry.js";
import { collectPackShots, type CollectedPackShots } from "./collect-pack-shots.js";
import { runViteBuild } from "./build.js";
import { copyEmbedLoader } from "./embed-loader.js";
import {
  buildPackManifest,
  writePackManifest,
  writeScenarioJson,
  verifyManifestFilesExist,
  type PackManifest,
} from "./pack-manifest.js";
import { DEFAULT_VIEWPORT, resolvePackViewport } from "./viewport.js";

/**
 * Generator version stamped into scenario.json (kept in sync with the CLI).
 * 0.0.2: scenario.json may carry `shots` (declared shot names, in step order).
 */
const PACK_GENERATOR_VERSION = "0.0.2";

/** Options for {@link runPack}. Paths may be relative; they are resolved here. */
export interface RunPackOptions {
  /** Path to a scenario directory (must contain steps.ts + a renderStep export). */
  readonly scenarioDir: string;
  /** Output directory for the bundle (default: ./<scenario-id>-bundle). */
  readonly outDir?: string;
  /**
   * Canonical viewport width in px. Omitted -> the scenario's own authored
   * viewport (`createScenario({ viewport })` or an exported `viewport`
   * constant) applies; a scenario that authors none falls back to
   * {@link DEFAULT_VIEWPORT}. Explicit flags always win over both.
   */
  readonly width?: number;
  /** Shell/container height in px. Same resolution chain as `width`. */
  readonly shellHeight?: number;
  /**
   * Float the scenario on a backdrop with a window shadow (screen-recording
   * framing). Opt-in: a staged embed paints its own background, giving up
   * the default transparent canvas that lets the host page show through.
   */
  readonly stage?: boolean;
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
  readonly hasPresenter: boolean;
  /**
   * The declared shot names recorded in scenario.json (empty = the scenario
   * authoritatively declares none), or undefined when the steps module could
   * not be loaded under Node and the shots are unknown.
   */
  readonly shots?: readonly string[];
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

  // The entry must live inside the scenario directory so the bundler's
  // node_modules resolution walks up into the consumer project.
  const tempDir = join(scenarioDir, ".scenar-pack");

  try {
    const renderFilePath = await detectRenderExport(scenarioDir);
    const providersPath = await resolveProvidersPath(scenarioDir);
    const hasNarration = await fileExists(join(scenarioDir, "narration", "manifest.json"));
    const hasPresenter = await fileExists(join(scenarioDir, "presenter", "manifest.json"));

    onLog(`Scenario:  ${scenarioId}`);
    onLog(`Render:    ${renderFilePath}`);
    onLog(`Providers: ${providersPath ?? "none"}`);
    onLog(`Narration: ${hasNarration ? "yes (manifest found)" : "none"}`);
    onLog(`Presenter: ${hasPresenter ? "yes (manifest found)" : "none"}`);
    onLog(`Output:    ${outDir}`);

    // 1. Discover the declared shots — and the authored viewport — by
    //    SSR-loading the steps module (same Vite resolution as the build
    //    below). Before the build on purpose: authoring errors — bad shot
    //    names, no steps array — fail fast here, without paying for a
    //    bundle. An import failure is tolerated: the shots are then unknown
    //    and scenario.json omits the key.
    const collectedShots = await collectPackShots(scenarioDir);
    onLog(`Shots:     ${describeCollectedShots(collectedShots)}`);

    // Canonical viewport: explicit options > the scenario's authored
    // viewport > the packer default. Authored viewports used to be silently
    // ignored (the authoring docs demonstrated `createScenario({ viewport })`
    // while pack only ever read its own options); the source is logged so a
    // surprising size is one log line from its explanation.
    const resolvedViewport = resolvePackViewport(
      options,
      collectedShots.recorded ? collectedShots.authoredViewport : null,
    );
    const { width, height: shellHeight } = resolvedViewport;
    const viewportSourceLabel = {
      explicit: "explicit",
      authored: "authored by the scenario",
      default: "packer default",
    }[resolvedViewport.source];
    onLog(`Viewport:  ${width}x${shellHeight} (${viewportSourceLabel})`);

    // 2. Generate the browser entry + index.html into the temp dir.
    const stage = options.stage ?? false;
    const entrySource = generateEmbedEntry({
      scenarioDir,
      renderFilePath,
      scenarioId,
      hasNarration,
      hasPresenter,
      providersPath,
      canonicalWidth: width,
      shellHeight,
      stage,
    });
    await mkdir(tempDir, { recursive: true });
    const entryFileName = "entry.tsx";
    const entryHtmlPath = join(tempDir, "index.html");
    await writeFile(join(tempDir, entryFileName), entrySource, "utf-8");
    await writeFile(entryHtmlPath, generateEmbedHtml(scenarioId, entryFileName, stage), "utf-8");

    // 3. Build the static bundle with Vite.
    onLog("Bundling embed with Vite...");
    await runViteBuild({ root: tempDir, outDir, entryHtmlPath });

    // 4. Copy the narration manifest + audio. The embed fetches
    //    ./narration/manifest.json at runtime and resolves each clip's
    //    relative src against it, so both must ship in the bundle.
    if (hasNarration) {
      await copyClipTrack(scenarioDir, outDir, "narration", ".mp3");
    }

    // 4a. Copy the presenter manifest + clips — the same runtime contract
    //     as narration: the embed fetches ./presenter/manifest.json and
    //     resolves each clip's relative src against it. CSP is
    //     `media-src 'self'`, so the clips must ship in the bundle.
    if (hasPresenter) {
      await copyClipTrack(scenarioDir, outDir, "presenter", ".mp4");
    }

    // 4b. Copy the soundtrack's assets: the authored music file (at its
    //     scenario-relative path, which is what the embed references) and
    //     the built-in SFX set from @scenar/react. Discovery rides the same
    //     SSR load as the shots; when the module was not loadable, the
    //     soundtrack (if any) cannot ship — warn rather than silently
    //     packing an embed whose audio 404s.
    if (collectedShots.recorded) {
      if (collectedShots.authoredSoundtrack) {
        const copied = await copySoundtrack(
          scenarioDir,
          outDir,
          collectedShots.authoredSoundtrack,
        );
        if (copied > 0) onLog(`Soundtrack: ${copied} audio file(s) copied into the bundle`);
      }
      // 4c. Copy title-card logos at their scenario-relative paths (the
      //     card component references them by that same path). Discovery
      //     rides the same SSR load as the shots and the soundtrack.
      if (collectedShots.authoredTitleCards) {
        const copied = await copyTitleCardLogos(
          scenarioDir,
          outDir,
          collectedShots.authoredTitleCards,
        );
        if (copied > 0) onLog(`Cards: ${copied} logo file(s) copied into the bundle`);
      }
    } else {
      onLog(
        "Warning: steps module not loadable under Node — if this scenario authors a " +
          "soundtrack or title cards, their asset files were NOT copied into the bundle.",
      );
    }

    // 5. Write the required scenario.json descriptor, recording the canonical
    //    viewport baked into the bundle so `deploy`/`serve`/`publish` can derive
    //    a correctly-proportioned embed snippet (DD-004), and — when known —
    //    the declared shot names so `shoot` and other tooling never boot a
    //    browser just to learn a bundle has nothing to capture.
    await writeScenarioJson(
      outDir,
      scenarioId,
      PACK_GENERATOR_VERSION,
      { width, height: shellHeight },
      collectedShots.recorded ? collectedShots.shots : undefined,
    );

    // 5b. Copy the optional <scenar-embed> loader into the bundle as embed.js
    //     (sibling of index.html), so the enhanced snippet works on any static
    //     host (GitHub Pages, `serve`, the edge) with no extra setup. It lands
    //     before the manifest pass below so it ships as a first-class bundle file.
    await copyEmbedLoader(outDir);

    // 6. Compute + write the deploy-facing pack manifest (validates the bundle
    //    against the backend allowlist; throws on any violation).
    const manifest = await buildPackManifest(outDir, scenarioId);
    await verifyManifestFilesExist(outDir, manifest);
    await writePackManifest(outDir, manifest);

    const totalBytes = manifest.files.reduce((sum, f) => sum + f.sizeBytes, 0);
    return {
      scenarioId,
      outDir,
      renderFilePath,
      providersPath,
      hasNarration,
      hasPresenter,
      shots: collectedShots.recorded ? collectedShots.shots : undefined,
      manifest,
      totalBytes,
    };
  } finally {
    if (!options.keepTemp) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

/**
 * Copy one clip track's manifest and media (narration mp3s, presenter
 * mp4s) from <scenarioDir>/<trackDir> into <outDir>/<trackDir>. The
 * manifest is the runtime index the embed fetches; the clips are what it
 * references by relative src. Cache files never ship.
 */
async function copyClipTrack(
  scenarioDir: string,
  outDir: string,
  trackDir: string,
  extension: string,
): Promise<void> {
  const srcDir = join(scenarioDir, trackDir);
  const destDir = join(outDir, trackDir);
  await mkdir(destDir, { recursive: true });
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const name = entry.name.toLowerCase();
    if (name === "manifest.json" || name.endsWith(extension)) {
      await copyFile(join(srcDir, entry.name), join(destDir, entry.name));
    }
  }
}

/**
 * Copy the soundtrack's audio into the bundle: the authored music file at
 * its scenario-relative path (the embed references it by that same path),
 * and the built-in SFX set from @scenar/react at the shared
 * {@link SFX_DEST_PATHS} locations the generated entry points at. Returns
 * the number of files copied. Remote music URLs copy nothing.
 */
async function copySoundtrack(
  scenarioDir: string,
  outDir: string,
  soundtrack: AuthoredSoundtrack,
): Promise<number> {
  let copied = 0;

  if (soundtrack.musicSrc) {
    const music = await resolveMusicAsset(scenarioDir, soundtrack.musicSrc);
    if (music) {
      const dest = join(outDir, music.destRelPath);
      await mkdir(dirname(dest), { recursive: true });
      await copyFile(music.sourcePath, dest);
      copied += 1;
    }
  }

  if (soundtrack.sfx) {
    const sfxPaths = resolveSfxAssetPaths(scenarioDir);
    for (const sound of ["click", "keystroke"] as const) {
      const dest = join(outDir, SFX_DEST_PATHS[sound]);
      await mkdir(dirname(dest), { recursive: true });
      await copyFile(sfxPaths[sound], dest);
      copied += 1;
    }
  }

  return copied;
}

/**
 * Copy title-card logos into the bundle at their scenario-relative paths.
 * A logo shared by intro and outro copies once; remote URLs copy nothing.
 * Returns the number of files copied.
 */
async function copyTitleCardLogos(
  scenarioDir: string,
  outDir: string,
  titleCards: AuthoredTitleCards,
): Promise<number> {
  let copied = 0;
  const copiedPaths = new Set<string>();

  for (const side of ["intro", "outro"] as const) {
    const logoSrc = titleCards[side]?.logoSrc;
    if (!logoSrc) continue;
    const logo = await resolveLogoAsset(scenarioDir, logoSrc, `titleCards.${side}.logoSrc`);
    if (!logo || copiedPaths.has(logo.destRelPath)) continue;
    const dest = join(outDir, logo.destRelPath);
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(logo.sourcePath, dest);
    copiedPaths.add(logo.destRelPath);
    copied += 1;
  }

  return copied;
}

/** One log-friendly line for the shot discovery outcome. */
function describeCollectedShots(collected: CollectedPackShots): string {
  if (!collected.recorded) {
    // Vite errors can run many lines; the first carries the message.
    return `unknown — steps module not loadable under Node (${collected.reason.split("\n")[0]})`;
  }
  return collected.shots.length === 0 ? "none declared" : collected.shots.join(", ");
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
