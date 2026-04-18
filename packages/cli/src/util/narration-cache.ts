import { createHash } from "node:crypto";
import { readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";

interface CacheEntry {
  hash: string;
  durationMs: number;
}

interface CacheFile {
  voice: string;
  steps: (CacheEntry | null)[];
}

const CACHE_FILENAME = ".narration-cache.json";

export function computeHash(narration: string, voice: string): string {
  return createHash("sha256")
    .update(`${voice}\0${narration}`)
    .digest("hex");
}

export async function loadCache(outputDir: string): Promise<CacheFile | null> {
  try {
    const raw = await readFile(join(outputDir, CACHE_FILENAME), "utf-8");
    return JSON.parse(raw) as CacheFile;
  } catch {
    return null;
  }
}

export async function saveCache(
  outputDir: string,
  cache: CacheFile,
): Promise<void> {
  await writeFile(
    join(outputDir, CACHE_FILENAME),
    JSON.stringify(cache, null, 2) + "\n",
  );
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check whether a step's narration is already cached (matching hash
 * and the MP3 file still exists on disk).
 */
export function isCached(
  cache: CacheFile | null,
  stepIndex: number,
  hash: string,
  voice: string,
): boolean {
  if (!cache || cache.voice !== voice) return false;
  const entry = cache.steps[stepIndex];
  return entry !== null && entry !== undefined && entry.hash === hash;
}

export function getCachedDuration(
  cache: CacheFile,
  stepIndex: number,
): number {
  return cache.steps[stepIndex]!.durationMs;
}

export function buildCacheFile(
  voice: string,
  totalSteps: number,
  entries: Map<number, { hash: string; durationMs: number }>,
): CacheFile {
  const steps: (CacheEntry | null)[] = Array.from(
    { length: totalSteps },
    () => null,
  );
  for (const [idx, entry] of entries) {
    steps[idx] = entry;
  }
  return { voice, steps };
}
