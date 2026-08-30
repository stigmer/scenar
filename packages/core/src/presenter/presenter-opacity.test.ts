import { describe, expect, it } from "vitest";
import { PRESENTER_FADE_MS, presenterOpacityAt } from "./presenter-opacity.js";

describe("presenterOpacityAt", () => {
  const CLIP_MS = 5000;

  it.each([
    ["before the clip", -1, 0],
    ["at clip start (first frame of the fade-in)", 0, 0],
    ["mid fade-in", PRESENTER_FADE_MS / 2, 0.5],
    ["at fade-in end", PRESENTER_FADE_MS, 1],
    ["mid-clip", CLIP_MS / 2, 1],
    ["at fade-out start", CLIP_MS - PRESENTER_FADE_MS, 1],
    ["mid fade-out", CLIP_MS - PRESENTER_FADE_MS / 2, 0.5],
    ["at clip end", CLIP_MS, 0],
    ["after the clip (step outlives it)", CLIP_MS + 1000, 0],
  ])("is %s → %d", (_label, intraStepMs, expected) => {
    expect(presenterOpacityAt(intraStepMs, CLIP_MS)).toBeCloseTo(expected, 5);
  });

  it("keeps a clip shorter than two fades continuous, peaking at its midpoint", () => {
    const shortClip = PRESENTER_FADE_MS; // 200ms: ramps intersect at 100ms
    expect(presenterOpacityAt(0, shortClip)).toBe(0);
    expect(presenterOpacityAt(shortClip / 2, shortClip)).toBeCloseTo(0.5, 5);
    expect(presenterOpacityAt(shortClip, shortClip)).toBe(0);
    // Monotonic up to the midpoint, down after it.
    expect(presenterOpacityAt(40, shortClip)).toBeLessThan(
      presenterOpacityAt(80, shortClip),
    );
    expect(presenterOpacityAt(160, shortClip)).toBeLessThan(
      presenterOpacityAt(120, shortClip),
    );
  });

  it("never exceeds 1 or drops below 0 across the whole clip", () => {
    for (let t = -100; t <= CLIP_MS + 100; t += 25) {
      const opacity = presenterOpacityAt(t, CLIP_MS);
      expect(opacity).toBeGreaterThanOrEqual(0);
      expect(opacity).toBeLessThanOrEqual(1);
    }
  });

  it("is 0 for a zero-duration clip", () => {
    expect(presenterOpacityAt(0, 0)).toBe(0);
    expect(presenterOpacityAt(100, 0)).toBe(0);
  });
});
