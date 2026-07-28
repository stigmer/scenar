import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SCENARIO_JSON_FILE } from "../pack/pack-manifest.js";

/** The outcome of reading a bundle's recorded shot names. */
export type BundleShots =
  /** scenario.json carries an authoritative list (possibly empty). */
  | { readonly recorded: true; readonly shots: readonly string[] }
  /**
   * No usable `shots` record — the bundle predates the key, pack could not
   * load the steps module, or the file is missing/malformed. The shots are
   * unknown; only booting the capture page can answer.
   */
  | { readonly recorded: false };

/**
 * Read the declared shot names recorded in a bundle's scenario.json.
 *
 * The sibling of {@link readBundleViewport}, with the same forgiving posture:
 * any missing/unreadable/malformed state degrades to `recorded: false` rather
 * than throwing, because an absent record only costs the caller a browser
 * boot — it must never fail an operation that a pre-`shots` bundle could
 * complete. Present-and-empty is meaningfully different: it is pack's
 * authoritative statement that the scenario declares no shots, which is what
 * lets `runShoot` skip the browser entirely.
 */
export async function readBundleShots(bundleDir: string): Promise<BundleShots> {
  try {
    const raw = await readFile(join(bundleDir, SCENARIO_JSON_FILE), "utf-8");
    const shots = (JSON.parse(raw) as { shots?: unknown }).shots;
    if (Array.isArray(shots) && shots.every((name) => typeof name === "string")) {
      return { recorded: true, shots };
    }
  } catch {
    // Missing/unreadable/invalid scenario.json — the shots are unknown.
  }
  return { recorded: false };
}
