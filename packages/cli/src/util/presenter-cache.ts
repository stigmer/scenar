import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Presenter clip cache — the `.narration-cache.json` pattern applied to
 * `scenar presenter`, where a cache hit saves real money (a HeyGen
 * generation costs dollars, not milliseconds).
 *
 * The per-step hash keys on the narration MP3 **bytes**: the audio is
 * the entire upstream state of a clip, so re-narrating a step (new
 * voice, new text, new provider) invalidates its presenter clip
 * automatically — no coordination needed between the two commands.
 */

interface PresenterCacheEntry {
  hash: string;
  durationMs: number;
}

export interface PresenterCacheFile {
  /**
   * The generation configuration this cache was written under:
   * `heygen/<engine>/<resolution>/<container>/<avatarId>`. Any change
   * regenerates everything — a clip from one avatar or quality tier
   * must never be served as a hit for another. The container is
   * recorded even though v1 is mp4-only, so a future webm option
   * invalidates correctly.
   */
  fingerprint: string;
  steps: (PresenterCacheEntry | null)[];
}

const CACHE_FILENAME = ".presenter-cache.json";

/** Compose the cache fingerprint for one generation configuration. */
export function presenterFingerprint(
  engine: string,
  resolution: string,
  container: string,
  avatarId: string,
): string {
  return `heygen/${engine}/${resolution}/${container}/${avatarId}`;
}

/** Hash a step's narration audio bytes — the clip's entire upstream state. */
export function computePresenterHash(audioBytes: Buffer): string {
  return createHash("sha256").update(audioBytes).digest("hex");
}

export async function loadPresenterCache(
  outputDir: string,
): Promise<PresenterCacheFile | null> {
  try {
    const raw = await readFile(join(outputDir, CACHE_FILENAME), "utf-8");
    return JSON.parse(raw) as PresenterCacheFile;
  } catch {
    return null;
  }
}

export async function savePresenterCache(
  outputDir: string,
  cache: PresenterCacheFile,
): Promise<void> {
  await writeFile(
    join(outputDir, CACHE_FILENAME),
    JSON.stringify(cache, null, 2) + "\n",
  );
}

/**
 * Whether a step's clip is already cached under this fingerprint. The
 * caller still verifies the clip file exists on disk — a cache entry
 * for a deleted file regenerates.
 */
export function isPresenterCached(
  cache: PresenterCacheFile | null,
  stepIndex: number,
  hash: string,
  fingerprint: string,
): boolean {
  if (!cache || cache.fingerprint !== fingerprint) return false;
  const entry = cache.steps[stepIndex];
  return entry !== null && entry !== undefined && entry.hash === hash;
}

export function buildPresenterCacheFile(
  fingerprint: string,
  totalSteps: number,
  entries: Map<number, { hash: string; durationMs: number }>,
): PresenterCacheFile {
  const steps: (PresenterCacheEntry | null)[] = Array.from(
    { length: totalSteps },
    () => null,
  );
  for (const [idx, entry] of entries) {
    steps[idx] = entry;
  }
  return { fingerprint, steps };
}
