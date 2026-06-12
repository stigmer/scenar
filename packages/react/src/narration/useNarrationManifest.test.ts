import { describe, expect, it } from "vitest";
import type { NarrationManifest } from "@scenar/core";
import { resolveNarrationManifestUrls } from "./useNarrationManifest.js";

describe("resolveNarrationManifestUrls", () => {
  it("resolves manifest-relative clip src against a nested manifest URL", () => {
    const manifest: NarrationManifest = {
      steps: [
        { src: "./step-0.mp3", durationMs: 1000 },
        { src: "./step-1.mp3", durationMs: 2000 },
      ],
    };

    const resolved = resolveNarrationManifestUrls(
      manifest,
      "/scenarios/welcome/narration/manifest.json",
    );

    // This is exactly the bug fix: a manifest-relative "./step-0.mp3" must land
    // under the manifest's own ./narration/ directory, not the page root.
    expect(resolved.steps[0]?.src).toMatch(/\/scenarios\/welcome\/narration\/step-0\.mp3$/);
    expect(resolved.steps[1]?.src).toMatch(/\/scenarios\/welcome\/narration\/step-1\.mp3$/);
  });

  it("resolves against the packed embed's ./narration/manifest.json", () => {
    const manifest: NarrationManifest = {
      steps: [{ src: "./step-0.mp3", durationMs: 1000 }],
    };

    const resolved = resolveNarrationManifestUrls(manifest, "./narration/manifest.json");

    expect(resolved.steps[0]?.src).toMatch(/\/narration\/step-0\.mp3$/);
  });

  it("passes absolute clip src through unchanged", () => {
    const manifest: NarrationManifest = {
      steps: [{ src: "https://cdn.example.com/a.mp3", durationMs: 1000 }],
    };

    const resolved = resolveNarrationManifestUrls(manifest, "./narration/manifest.json");

    expect(resolved.steps[0]?.src).toBe("https://cdn.example.com/a.mp3");
  });

  it("preserves null entries (steps without narration)", () => {
    const manifest: NarrationManifest = {
      steps: [{ src: "./step-0.mp3", durationMs: 1000 }, null],
    };

    const resolved = resolveNarrationManifestUrls(manifest, "./narration/manifest.json");

    expect(resolved.steps[1]).toBeNull();
  });

  it("preserves durations", () => {
    const manifest: NarrationManifest = {
      steps: [{ src: "./step-0.mp3", durationMs: 2340 }],
    };

    const resolved = resolveNarrationManifestUrls(manifest, "./narration/manifest.json");

    expect(resolved.steps[0]?.durationMs).toBe(2340);
  });
});
