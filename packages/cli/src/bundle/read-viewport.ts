import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SCENARIO_JSON_FILE } from "../pack/pack-manifest.js";
import { DEFAULT_VIEWPORT, parseViewport, type Viewport } from "../pack/viewport.js";

/** The outcome of reading a bundle's recorded viewport. */
export interface BundleViewport {
  /** The viewport to use — the recorded one, or {@link DEFAULT_VIEWPORT}. */
  readonly viewport: Viewport;
  /**
   * Whether the viewport came from the bundle's scenario.json. False when the
   * file is missing/unreadable/invalid (older bundles, or hand-assembled dirs),
   * in which case {@link DEFAULT_VIEWPORT} is returned. Callers decide whether
   * to surface a "re-pack to embed at the exact aspect ratio" note.
   */
  readonly recorded: boolean;
}

/**
 * Read the canonical viewport recorded in a bundle's scenario.json (DD-004),
 * falling back to {@link DEFAULT_VIEWPORT} when it is absent or malformed.
 *
 * Shared by `deploy` and `serve` so the two derive the embed snippet's aspect
 * ratio from one place and cannot drift. Pure-ish (one file read, no logging) —
 * the caller owns any user-facing note about a missing viewport.
 */
export async function readBundleViewport(bundleDir: string): Promise<BundleViewport> {
  try {
    const raw = await readFile(join(bundleDir, SCENARIO_JSON_FILE), "utf-8");
    const viewport = parseViewport((JSON.parse(raw) as { viewport?: unknown }).viewport);
    if (viewport) return { viewport, recorded: true };
  } catch {
    // Missing/unreadable/invalid scenario.json — fall through to the default.
  }
  return { viewport: DEFAULT_VIEWPORT, recorded: false };
}
