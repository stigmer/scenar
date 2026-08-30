import { access } from "node:fs/promises";
import { isAbsolute, join, normalize } from "node:path";
import { CONTENT_TYPE_BY_EXTENSION, finalExtension } from "../pack/bundle-contract.js";

/**
 * A scenario-local asset reference resolved for shipping: where the
 * authored file is, and where it lands in a staged public dir or packed
 * bundle (the authored path with its leading `./` removed, so the
 * runtime reference resolves onto the shipped file in both outputs).
 */
export interface ScenarioAsset {
  /** Absolute path of the authored file. */
  readonly sourcePath: string;
  /** Destination path relative to the public dir / bundle root. */
  readonly destRelPath: string;
}

/**
 * True when an asset src is a remote URL (has a scheme) rather than a
 * scenario-relative path. Remote assets are referenced, never copied.
 */
export function isRemoteUrl(src: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(src);
}

/**
 * Resolve a scenario-relative asset reference against its scenario
 * directory — the shared containment-and-existence contract behind
 * every shipped asset (soundtrack music, title-card logos).
 *
 * Returns `null` for remote URLs (used from where they live). Throws
 * with an actionable message when the path escapes the scenario
 * directory or the file does not exist — both would otherwise surface
 * as a broken reference in the packed embed or the rendered video.
 *
 * @param configPath - The authored field, for error messages
 *   (e.g. "soundtrack.musicSrc").
 * @param expectation - What a valid reference looks like, appended to
 *   the error (e.g. 'an MP3 inside the scenario directory').
 */
export async function resolveScenarioAsset(
  scenarioDir: string,
  src: string,
  configPath: string,
  expectation: string,
): Promise<ScenarioAsset | null> {
  if (isRemoteUrl(src)) return null;

  const destRelPath = normalize(src).replace(/^\.\//, "");
  if (isAbsolute(destRelPath) || destRelPath === ".." || destRelPath.startsWith("../")) {
    throw new Error(
      `${configPath} "${src}" points outside the scenario directory.\n` +
        `The reference must be ${expectation} so it can ship with the bundle,\n` +
        "or an absolute URL.",
    );
  }

  const sourcePath = join(scenarioDir, destRelPath);
  try {
    await access(sourcePath);
  } catch {
    throw new Error(
      `${configPath} "${src}" not found at ${sourcePath}.\n` +
        `Add the file (${expectation}), or fix the path in the config.`,
    );
  }

  return { sourcePath, destRelPath };
}

/**
 * The image extensions the packed-embed deploy contract serves —
 * derived from the canonical extension table so this can never drift
 * from the server's allowlist. Notably NO svg (active content).
 */
export const IMAGE_EXTENSIONS: readonly string[] = Object.entries(
  CONTENT_TYPE_BY_EXTENSION,
)
  .filter(([, contentType]) => contentType.startsWith("image/"))
  .map(([extension]) => extension);

/**
 * Resolve a title card's `logo_src` against its scenario directory,
 * additionally enforcing the deploy contract's image formats — an
 * unservable extension must fail at build time, not as a 404 (or a
 * rejected deploy) later.
 */
export async function resolveLogoAsset(
  scenarioDir: string,
  logoSrc: string,
  configPath: string,
): Promise<ScenarioAsset | null> {
  const asset = await resolveScenarioAsset(
    scenarioDir,
    logoSrc,
    configPath,
    "an image inside the scenario directory (e.g. ./logo.png)",
  );
  if (asset === null) return null;

  const extension = finalExtension(asset.destRelPath);
  if (!IMAGE_EXTENSIONS.includes(extension)) {
    throw new Error(
      `${configPath} "${logoSrc}" is not a supported image format.\n` +
        `The deploy contract serves: ${IMAGE_EXTENSIONS.join(", ")}. ` +
        "SVG is deliberately excluded (active content) — inline it in a view instead.",
    );
  }

  return asset;
}
