import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  computeHash,
  isCached,
  buildCacheFile,
  loadCache,
  saveCache,
} from "../util/narration-cache.js";

const FINGERPRINT_A = "openai/tts-1/alloy";
const FINGERPRINT_B = "elevenlabs/eleven_multilingual_v2/21m00Tcm4TlvDq8ikWAM";

describe("computeHash", () => {
  it("is deterministic for identical inputs", () => {
    expect(computeHash("hello", "nova", FINGERPRINT_A)).toBe(
      computeHash("hello", "nova", FINGERPRINT_A),
    );
  });

  it("changes when the text changes", () => {
    expect(computeHash("hello", "nova", FINGERPRINT_A)).not.toBe(
      computeHash("goodbye", "nova", FINGERPRINT_A),
    );
  });

  it("changes when the voice changes", () => {
    expect(computeHash("hello", "nova", FINGERPRINT_A)).not.toBe(
      computeHash("hello", "alloy", FINGERPRINT_A),
    );
  });

  it("changes when the provider fingerprint changes", () => {
    // The bug this guards against: same text and voice narrated by a
    // different provider/model must never collide to the same cache key.
    expect(computeHash("hello", "", FINGERPRINT_A)).not.toBe(
      computeHash("hello", "", FINGERPRINT_B),
    );
  });

  it("does not collide when a field boundary shifts", () => {
    // Delimited hashing: ("ab", "c") and ("a", "bc") must differ.
    expect(computeHash("ab", "c", FINGERPRINT_A)).not.toBe(
      computeHash("a", "bc", FINGERPRINT_A),
    );
  });
});

describe("isCached", () => {
  const hash = computeHash("hello", "nova", FINGERPRINT_A);
  const cache = buildCacheFile(
    FINGERPRINT_A,
    "nova",
    2,
    new Map([[0, { hash, durationMs: 1200 }]]),
  );

  it("hits when fingerprint, voice, and hash all match", () => {
    expect(isCached(cache, 0, hash, "nova", FINGERPRINT_A)).toBe(true);
  });

  it("misses when the provider fingerprint differs", () => {
    expect(isCached(cache, 0, hash, "nova", FINGERPRINT_B)).toBe(false);
  });

  it("misses when the voice differs", () => {
    expect(isCached(cache, 0, hash, "echo", FINGERPRINT_A)).toBe(false);
  });

  it("misses when the step hash differs", () => {
    const otherHash = computeHash("changed text", "nova", FINGERPRINT_A);
    expect(isCached(cache, 0, otherHash, "nova", FINGERPRINT_A)).toBe(false);
  });

  it("misses for a step with no cache entry", () => {
    expect(isCached(cache, 1, hash, "nova", FINGERPRINT_A)).toBe(false);
  });

  it("misses when there is no cache file", () => {
    expect(isCached(null, 0, hash, "nova", FINGERPRINT_A)).toBe(false);
  });
});

describe("cache file round-trip and legacy handling", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "scenar-cache-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("persists the fingerprint through save and load", async () => {
    const hash = computeHash("hello", "", FINGERPRINT_B);
    const cache = buildCacheFile(
      FINGERPRINT_B,
      "",
      1,
      new Map([[0, { hash, durationMs: 900 }]]),
    );

    await saveCache(tempDir, cache);
    const loaded = await loadCache(tempDir);

    expect(loaded).not.toBeNull();
    expect(isCached(loaded, 0, hash, "", FINGERPRINT_B)).toBe(true);
    expect(isCached(loaded, 0, hash, "", FINGERPRINT_A)).toBe(false);
  });

  it("treats a legacy cache file without a fingerprint as stale", async () => {
    // Cache files written before the fingerprint field existed must
    // regenerate once rather than serve audio of unknown provenance.
    const legacyHash = computeHash("hello", "", FINGERPRINT_A);
    writeFileSync(
      join(tempDir, ".narration-cache.json"),
      JSON.stringify({
        voice: "",
        steps: [{ hash: legacyHash, durationMs: 900 }],
      }),
    );

    const loaded = await loadCache(tempDir);
    expect(loaded).not.toBeNull();
    expect(isCached(loaded, 0, legacyHash, "", FINGERPRINT_A)).toBe(false);
  });

  it("returns null when no cache file exists", async () => {
    expect(await loadCache(tempDir)).toBeNull();
  });
});
