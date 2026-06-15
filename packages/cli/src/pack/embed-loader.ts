import { createRequire } from "node:module";
import { copyFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * The loader artifact's name inside the bundle — a sibling of `index.html`. The
 * enhanced `<scenar-embed>` snippet references it as `embed.js` relative to the
 * embed URL, so `serve`/`publish` carry it automatically with no change to the
 * publish-flow bundle contract.
 */
export const EMBED_LOADER_FILE = "embed.js";

const requireFromHere = createRequire(import.meta.url);

/**
 * Copy `@scenar/embed`'s prebuilt loader (its `./loader` export → the IIFE
 * `embed.global.js`) into the bundle as {@link EMBED_LOADER_FILE}.
 *
 * The artifact is resolved through the package export rather than a hard-coded
 * path, so it works the same in the workspace (symlinked) and in a published
 * install. `@scenar/cli` depends on `@scenar/embed`, so it is always present and
 * built before the CLI (and thus before `pack` runs).
 */
export async function copyEmbedLoader(outDir: string): Promise<void> {
  const loaderPath = requireFromHere.resolve("@scenar/embed/loader");
  await copyFile(loaderPath, join(outDir, EMBED_LOADER_FILE));
}
