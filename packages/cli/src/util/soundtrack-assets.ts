import { access } from "node:fs/promises";
import { createRequire } from "node:module";
import { isAbsolute, join, normalize } from "node:path";

/** Absolute filesystem locations of the built-in SFX asset files. */
export interface SfxAssetPaths {
  readonly click: string;
  readonly keystroke: string;
}

/**
 * Where the built-in SFX set lives inside a staged render public dir and
 * inside a packed bundle — one convention, shared with the composition's
 * `sfxSrcs` default and the embed entry's `soundtrackSources`, so every
 * consumer looks in the same place.
 */
export const SFX_DEST_PATHS: SfxAssetPaths = {
  click: "soundtrack/sfx/click.mp3",
  keystroke: "soundtrack/sfx/keystroke.mp3",
};

/**
 * True when a soundtrack `musicSrc` is a remote URL (has a scheme) rather
 * than a scenario-relative path. Remote music is referenced, never copied.
 */
export function isRemoteUrl(src: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(src);
}

/**
 * Resolve the built-in SFX asset files from `@scenar/react`, using the
 * given directory as the resolution context — the scenario directory, so
 * the assets come from the same installed `@scenar/react` the generated
 * entry imports.
 */
export function resolveSfxAssetPaths(fromDir: string): SfxAssetPaths {
  const require = createRequire(join(fromDir, "__scenar_resolver__.js"));
  try {
    return {
      click: require.resolve("@scenar/react/assets/sfx/click.mp3"),
      keystroke: require.resolve("@scenar/react/assets/sfx/keystroke.mp3"),
    };
  } catch {
    throw new Error(
      "soundtrack.sfx is enabled, but @scenar/react's sound-effect assets could not be\n" +
        `resolved from ${fromDir}.\n\n` +
        "The default SFX set ships inside @scenar/react (assets/sfx/). Install or update\n" +
        "it in this project: pnpm add @scenar/react",
    );
  }
}

/** A scenario-local music asset: where it is, and where it ships. */
export interface MusicAsset {
  /** Absolute path of the authored file. */
  readonly sourcePath: string;
  /**
   * Destination path relative to the staged public dir / packed bundle
   * root — the authored path with its leading `./` removed, so the
   * runtime reference ("./soundtrack/music.mp3") lands on the shipped
   * file in both outputs.
   */
  readonly destRelPath: string;
}

/**
 * Resolve a soundtrack's `music_src` against its scenario directory.
 *
 * Returns `null` for remote URLs (played from where they live). Throws
 * with an actionable message when the referenced file does not exist or
 * the path escapes the scenario directory — both would otherwise surface
 * as a silently music-less video or a 404 in the packed embed.
 */
export async function resolveMusicAsset(
  scenarioDir: string,
  musicSrc: string,
): Promise<MusicAsset | null> {
  if (isRemoteUrl(musicSrc)) return null;

  const destRelPath = normalize(musicSrc).replace(/^\.\//, "");
  if (isAbsolute(destRelPath) || destRelPath === ".." || destRelPath.startsWith("../")) {
    throw new Error(
      `soundtrack.musicSrc "${musicSrc}" points outside the scenario directory.\n` +
        "Music must live inside the scenario directory (e.g. ./soundtrack/music.mp3)\n" +
        "so it can ship with the bundle, or be an absolute URL.",
    );
  }

  const sourcePath = join(scenarioDir, destRelPath);
  try {
    await access(sourcePath);
  } catch {
    throw new Error(
      `soundtrack.musicSrc "${musicSrc}" not found at ${sourcePath}.\n` +
        "Add the music file (MP3), or fix the path in the soundtrack config.",
    );
  }

  return { sourcePath, destRelPath };
}
