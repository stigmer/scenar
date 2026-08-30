import { copyFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { AuthoredSoundtrack, AuthoredTitleCards } from "../util/load-ts.js";
import {
  SFX_DEST_PATHS,
  type SfxAssetPaths,
  resolveMusicAsset,
} from "../util/soundtrack-assets.js";
import { resolveLogoAsset } from "../util/scenario-assets.js";

export interface StageRenderAssetsInput {
  /** Absolute path to the scenario directory. */
  readonly scenarioDir: string;
  /** Absolute path of the Remotion public dir to stage into (created). */
  readonly publicDir: string;
  /** Whether the scenario has a narration manifest (+ clips to stage). */
  readonly hasNarration: boolean;
  /** Whether the scenario has a presenter manifest (+ clips to stage). */
  readonly hasPresenter?: boolean;
  /** The scenario's authored soundtrack, if any. */
  readonly soundtrack?: AuthoredSoundtrack;
  /**
   * Absolute locations of the built-in SFX assets — required when
   * `soundtrack.sfx` is enabled (the caller resolves them from
   * `@scenar/react` via `resolveSfxAssetPaths`).
   */
  readonly sfxPaths?: SfxAssetPaths;
  /** The scenario's authored title cards, if any (logo assets to stage). */
  readonly titleCards?: AuthoredTitleCards;
}

/**
 * Stage every local asset a render needs into a Remotion public dir, so
 * `staticFile()` resolution inside `ScenarioComposition` finds real files.
 *
 * The layout mirrors how each src is written:
 * - Narration clips: manifest srcs are manifest-relative (`./step-N.mp3`),
 *   so the clips stage flat at the public root.
 * - Presenter clips: same convention (`./step-N.mp4`), staged flat at the
 *   public root beside the narration clips — the extensions never collide.
 * - Music: `musicSrc` is scenario-relative (`./soundtrack/music.mp3`), so
 *   the file stages at that same relative path. Remote URLs stage nothing.
 * - Built-in SFX: staged at {@link SFX_DEST_PATHS}, the composition's
 *   default `sfxSrcs`.
 * - Title-card logos: `logoSrc` is scenario-relative like music, staged
 *   at its relative path (intro and outro may share one file — it stages
 *   once). Remote URLs stage nothing.
 *
 * Returns the number of files staged. Zero means the render needs no
 * local assets and the caller can skip the public dir entirely.
 */
export async function stageRenderAssets(input: StageRenderAssetsInput): Promise<number> {
  let staged = 0;

  if (input.hasNarration) {
    staged += await stageClipDirectory(input.scenarioDir, "narration", ".mp3", input.publicDir);
  }

  if (input.hasPresenter) {
    staged += await stageClipDirectory(input.scenarioDir, "presenter", ".mp4", input.publicDir);
  }

  const musicSrc = input.soundtrack?.musicSrc;
  if (musicSrc) {
    const music = await resolveMusicAsset(input.scenarioDir, musicSrc);
    if (music) {
      const dest = join(input.publicDir, music.destRelPath);
      await mkdir(dirname(dest), { recursive: true });
      await copyFile(music.sourcePath, dest);
      staged += 1;
    }
  }

  if (input.soundtrack?.sfx && input.sfxPaths) {
    for (const sound of ["click", "keystroke"] as const) {
      const dest = join(input.publicDir, SFX_DEST_PATHS[sound]);
      await mkdir(dirname(dest), { recursive: true });
      await copyFile(input.sfxPaths[sound], dest);
      staged += 1;
    }
  }

  const stagedLogos = new Set<string>();
  for (const side of ["intro", "outro"] as const) {
    const logoSrc = input.titleCards?.[side]?.logoSrc;
    if (!logoSrc) continue;
    const logo = await resolveLogoAsset(
      input.scenarioDir,
      logoSrc,
      `titleCards.${side}.logoSrc`,
    );
    if (!logo || stagedLogos.has(logo.destRelPath)) continue;
    const dest = join(input.publicDir, logo.destRelPath);
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(logo.sourcePath, dest);
    stagedLogos.add(logo.destRelPath);
    staged += 1;
  }

  return staged;
}

/**
 * Copy every clip of one track (narration mp3s, presenter mp4s) flat into
 * the public root — manifest srcs are manifest-relative (`./step-N.<ext>`),
 * which `staticFile()` resolves at the root.
 */
async function stageClipDirectory(
  scenarioDir: string,
  trackDir: string,
  extension: string,
  publicDir: string,
): Promise<number> {
  const sourceDir = join(scenarioDir, trackDir);
  let entries;
  try {
    entries = await readdir(sourceDir, { withFileTypes: true });
  } catch {
    return 0;
  }

  let staged = 0;
  await mkdir(publicDir, { recursive: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(extension)) continue;
    await copyFile(join(sourceDir, entry.name), join(publicDir, entry.name));
    staged += 1;
  }
  return staged;
}
