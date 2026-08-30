import { copyFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { AuthoredSoundtrack } from "../util/load-ts.js";
import {
  SFX_DEST_PATHS,
  type SfxAssetPaths,
  resolveMusicAsset,
} from "../util/soundtrack-assets.js";

export interface StageRenderAudioInput {
  /** Absolute path to the scenario directory. */
  readonly scenarioDir: string;
  /** Absolute path of the Remotion public dir to stage into (created). */
  readonly publicDir: string;
  /** Whether the scenario has a narration manifest (+ clips to stage). */
  readonly hasNarration: boolean;
  /** The scenario's authored soundtrack, if any. */
  readonly soundtrack?: AuthoredSoundtrack;
  /**
   * Absolute locations of the built-in SFX assets — required when
   * `soundtrack.sfx` is enabled (the caller resolves them from
   * `@scenar/react` via `resolveSfxAssetPaths`).
   */
  readonly sfxPaths?: SfxAssetPaths;
}

/**
 * Stage every audio file a render needs into a Remotion public dir, so
 * `staticFile()` resolution inside `ScenarioComposition` finds real files.
 *
 * The layout mirrors how each src is written:
 * - Narration clips: manifest srcs are manifest-relative (`./step-N.mp3`),
 *   so the clips stage flat at the public root.
 * - Music: `musicSrc` is scenario-relative (`./soundtrack/music.mp3`), so
 *   the file stages at that same relative path. Remote URLs stage nothing.
 * - Built-in SFX: staged at {@link SFX_DEST_PATHS}, the composition's
 *   default `sfxSrcs`.
 *
 * Returns the number of files staged. Zero means the render has no local
 * audio and the caller can skip the public dir entirely.
 */
export async function stageRenderAudio(input: StageRenderAudioInput): Promise<number> {
  let staged = 0;

  if (input.hasNarration) {
    staged += await stageNarrationClips(input.scenarioDir, input.publicDir);
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

  return staged;
}

/** Copy every narration mp3 flat into the public root (srcs are `./step-N.mp3`). */
async function stageNarrationClips(scenarioDir: string, publicDir: string): Promise<number> {
  const narrationDir = join(scenarioDir, "narration");
  let entries;
  try {
    entries = await readdir(narrationDir, { withFileTypes: true });
  } catch {
    return 0;
  }

  let staged = 0;
  await mkdir(publicDir, { recursive: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".mp3")) continue;
    await copyFile(join(narrationDir, entry.name), join(publicDir, entry.name));
    staged += 1;
  }
  return staged;
}
