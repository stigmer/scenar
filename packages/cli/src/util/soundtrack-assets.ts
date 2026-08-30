import { createRequire } from "node:module";
import { join } from "node:path";
import { resolveScenarioAsset, type ScenarioAsset } from "./scenario-assets.js";

export { isRemoteUrl } from "./scenario-assets.js";

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
export type MusicAsset = ScenarioAsset;

/**
 * Resolve a soundtrack's `music_src` against its scenario directory —
 * the shared {@link resolveScenarioAsset} contract with music wording.
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
  return resolveScenarioAsset(
    scenarioDir,
    musicSrc,
    "soundtrack.musicSrc",
    "an MP3 inside the scenario directory (e.g. ./soundtrack/music.mp3)",
  );
}
