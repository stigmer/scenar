import { join, resolve } from "node:path";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import {
  PACK_MANIFEST_FILE,
  SCENARIO_JSON_FILE,
  buildPackManifest,
  verifyManifestFilesExist,
  writePackManifest,
} from "../pack/pack-manifest.js";
import { readBundleViewport } from "../bundle/read-viewport.js";
import { startBundleServer } from "../serve/static-server.js";
import { createPlaywrightShotBrowser } from "./playwright-browser.js";
import type { ShotBrowser, ShotCaptureInfo, ShotSession, ShotTheme } from "./types.js";

/** Directory inside the bundle where stills land (and deploy from). */
export const STILLS_DIR = "stills";

/** How long to wait for the capture page's driver before failing. */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Extra room around the canonical frame so the element screenshot never has
 * to scroll-stitch (stitching re-rasterizes and would break byte-exactness).
 */
const VIEWPORT_MARGIN_PX = 64;

/** Options for {@link runShoot}. Paths may be relative; they are resolved here. */
export interface RunShootOptions {
  /** A packed bundle directory (a `scenar pack` output with a ?shot entry). */
  readonly bundleDir: string;
  /** Themes to capture (default: both — DD-02 D2). */
  readonly themes?: readonly ShotTheme[];
  /**
   * Capture everything twice in fresh browser sessions and byte-compare —
   * the determinism gate. A mismatch means some component renders
   * nondeterministically and the stills cannot be trusted.
   */
  readonly verify?: boolean;
  /** Per-page readiness timeout in ms (default {@link DEFAULT_TIMEOUT_MS}). */
  readonly timeoutMs?: number;
  /** Progress sink for mid-operation messages. */
  readonly onLog?: (message: string) => void;
  /** Test seam: swap the real Playwright browser for a fake. */
  readonly browserFactory?: () => Promise<ShotBrowser>;
}

/** The outcome of a successful shoot. */
export interface ShootResult {
  readonly scenarioId: string;
  readonly bundleDir: string;
  /** The bundle's declared shots, in timeline order (empty = nothing to do). */
  readonly shots: ShotCaptureInfo["shots"];
  /** Bundle-relative paths of the stills written, in write order. */
  readonly files: readonly string[];
  readonly themes: readonly ShotTheme[];
  /** True when `verify` ran and every still was byte-identical. */
  readonly verified: boolean;
}

/**
 * Render a packed bundle's declared shots to still images — the pure
 * orchestration behind `scenar shoot`, with no process/exit coupling so both
 * the CLI command and the MCP server can call it.
 *
 * Bundle-centric by design: stills are captured from (and written into) the
 * exact bundle that deploys, so they can never depict anything but what
 * ships. The pack manifest is rebuilt afterwards so `publish`/deploy pick
 * the stills up with zero pipeline changes.
 *
 * `stills/` is cleared up front, unconditionally — even when the scenario
 * declares no shots — and the manifest is rebuilt in every path. A removed
 * or renamed shot must never linger in a deployed bundle, and a manifest
 * listing deleted files would fail its own existence check at the next
 * publish.
 */
export async function runShoot(options: RunShootOptions): Promise<ShootResult> {
  const onLog = options.onLog ?? (() => {});
  const bundleDir = resolve(options.bundleDir);
  const themes = options.themes ?? (["light", "dark"] as const);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const scenarioId = await validateBundle(bundleDir);
  const { viewport } = await readBundleViewport(bundleDir);

  onLog(`Scenario:  ${scenarioId}`);
  onLog(`Bundle:    ${bundleDir}`);
  onLog(`Viewport:  ${viewport.width}x${viewport.height} (DPR 2)`);
  onLog(`Themes:    ${themes.join(", ")}`);

  await rm(join(bundleDir, STILLS_DIR), { recursive: true, force: true });

  const server = await startBundleServer({ rootDir: bundleDir, port: 0 });
  let browser: ShotBrowser | undefined;
  try {
    browser = await (options.browserFactory ?? createPlaywrightShotBrowser)();

    const sessionViewport = {
      width: viewport.width + VIEWPORT_MARGIN_PX,
      height: viewport.height + VIEWPORT_MARGIN_PX,
    };

    const captures = new Map<ShotTheme, { info: ShotCaptureInfo; images: Buffer[] }>();
    for (const theme of themes) {
      captures.set(theme, await captureTheme(browser, server.url, theme, sessionViewport, timeoutMs));
    }

    const first = captures.get(themes[0]!)!.info;
    assertShotsAgreeAcrossThemes(captures);

    if (first.shots.length === 0) {
      onLog("No steps declare a `shot` — nothing to capture.");
      await rebuildManifest(bundleDir, scenarioId);
      return { scenarioId, bundleDir, shots: [], files: [], themes, verified: false };
    }

    if (options.verify) {
      onLog("Verifying determinism (second capture in fresh sessions)...");
      for (const theme of themes) {
        const rerun = await captureTheme(browser, server.url, theme, sessionViewport, timeoutMs);
        assertByteIdentical(theme, captures.get(theme)!, rerun);
      }
      onLog(`Determinism verified: every still byte-identical across sessions.`);
    }

    await mkdir(join(bundleDir, STILLS_DIR), { recursive: true });
    const files: string[] = [];
    for (const theme of themes) {
      const { info, images } = captures.get(theme)!;
      for (const [i, shot] of info.shots.entries()) {
        const relative = `${STILLS_DIR}/${shot.name}.${theme}.png`;
        await writeFile(join(bundleDir, ...relative.split("/")), images[i]!);
        files.push(relative);
        onLog(`Captured:  ${relative}`);
      }
    }

    await rebuildManifest(bundleDir, scenarioId);
    return {
      scenarioId,
      bundleDir,
      shots: first.shots,
      files,
      themes,
      verified: options.verify ?? false,
    };
  } finally {
    await browser?.close().catch(() => {});
    await server.close().catch(() => {});
  }
}

/** Walk one themed session through every shot, collecting screenshots. */
async function captureTheme(
  browser: ShotBrowser,
  baseUrl: string,
  theme: ShotTheme,
  viewport: { width: number; height: number },
  timeoutMs: number,
): Promise<{ info: ShotCaptureInfo; images: Buffer[] }> {
  // `?shot` (bare) switches the packed entry into capture mode; the scenar
  // token class needs `theme=dark` on top of the context's colorScheme
  // emulation — both halves of a dark variant (DD-02 D2).
  const url = `${baseUrl}?shot${theme === "dark" ? "&theme=dark" : ""}`;
  const session: ShotSession = await browser.newSession({ theme, viewport });
  try {
    const info = await session.open(url, timeoutMs);
    const images: Buffer[] = [];
    // Sequential walk in timeline order — never a cold jump (cross-step
    // React state does not survive one; spike-proven, DD-02).
    for (const shot of info.shots) {
      await session.walkTo(shot.timeMs);
      images.push(await session.screenshotFrame());
    }
    return { info, images };
  } finally {
    await session.close().catch(() => {});
  }
}

/** A bundle is shootable when it has the three files `scenar pack` writes. */
async function validateBundle(bundleDir: string): Promise<string> {
  const info = await stat(bundleDir).catch(() => null);
  if (!info || !info.isDirectory()) {
    throw new Error(`${bundleDir} is not a directory. Pass a bundle produced by \`scenar pack\`.`);
  }
  for (const required of ["index.html", SCENARIO_JSON_FILE, PACK_MANIFEST_FILE]) {
    const fileInfo = await stat(join(bundleDir, required)).catch(() => null);
    if (!fileInfo || !fileInfo.isFile()) {
      throw new Error(
        `no ${required} in ${bundleDir}. Run \`scenar pack\` to produce a shootable bundle first.`,
      );
    }
  }
  const scenarioJson = JSON.parse(
    await readFile(join(bundleDir, SCENARIO_JSON_FILE), "utf-8"),
  ) as { id?: unknown };
  if (typeof scenarioJson.id !== "string" || scenarioJson.id.length === 0) {
    throw new Error(`${SCENARIO_JSON_FILE} in ${bundleDir} has no scenario id.`);
  }
  return scenarioJson.id;
}

/**
 * The shot list is derived from the bundled steps, so every theme must
 * report the identical list — a divergence means the bundle itself renders
 * nondeterministically and nothing downstream can be trusted.
 */
function assertShotsAgreeAcrossThemes(
  captures: Map<ShotTheme, { info: ShotCaptureInfo; images: Buffer[] }>,
): void {
  const lists = [...captures.entries()].map(
    ([theme, { info }]) => [theme, JSON.stringify(info.shots)] as const,
  );
  const [, reference] = lists[0]!;
  for (const [theme, list] of lists) {
    if (list !== reference) {
      throw new Error(
        `internal error: the ${theme} capture reported a different shot list than ${lists[0]![0]}`,
      );
    }
  }
}

/** Byte-compare two capture passes of the same theme (the `--verify` gate). */
function assertByteIdentical(
  theme: ShotTheme,
  first: { info: ShotCaptureInfo; images: Buffer[] },
  second: { info: ShotCaptureInfo; images: Buffer[] },
): void {
  const differing = first.info.shots
    .filter((_, i) => !first.images[i]!.equals(second.images[i]!))
    .map((shot) => shot.name);
  if (differing.length > 0) {
    throw new Error(
      `determinism check failed (${theme}): shot(s) ${differing.join(", ")} differed ` +
        `across fresh sessions. Some component renders nondeterministically — ` +
        `fix that before trusting these stills (see DD-02's determinism recipe).`,
    );
  }
}

/**
 * Re-list the bundle after stills changed. `buildPackManifest` validates
 * every file against the deploy allowlist, so a bad shot filename fails
 * here, locally, rather than mid-upload.
 */
async function rebuildManifest(bundleDir: string, scenarioId: string): Promise<void> {
  const manifest = await buildPackManifest(bundleDir, scenarioId);
  await verifyManifestFilesExist(bundleDir, manifest);
  await writePackManifest(bundleDir, manifest);
}
