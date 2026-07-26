import { describe, expect, it } from "vitest";
import {
  VIEWPORT_CAMERA_AT_REST,
  VIEWPORT_TRANSFORM_IDENTITY,
  cameraEase,
  interpolateViewportTransform,
} from "./transform.js";

describe("cameraEase", () => {
  it("starts at 0 and ends at 1", () => {
    expect(cameraEase(0)).toBe(0);
    expect(cameraEase(1)).toBe(1);
  });

  it("clamps out-of-range progress", () => {
    expect(cameraEase(-0.5)).toBe(0);
    expect(cameraEase(1.5)).toBe(1);
  });

  it("is monotonically non-decreasing", () => {
    let prev = cameraEase(0);
    for (let i = 1; i <= 100; i++) {
      const next = cameraEase(i / 100);
      expect(next).toBeGreaterThanOrEqual(prev);
      prev = next;
    }
  });

  it("decelerates: covers more than half the distance in the first quarter", () => {
    // The defining property of a camera move — commit fast, glide to rest.
    expect(cameraEase(0.25)).toBeGreaterThan(0.5);
  });

  it("never overshoots", () => {
    for (let i = 0; i <= 100; i++) {
      expect(cameraEase(i / 100)).toBeLessThanOrEqual(1);
    }
  });
});

describe("interpolateViewportTransform", () => {
  const from = { scale: 1, x: 0, y: 0 };
  const to = { scale: 1.5, x: -200, y: -120 };

  it("returns `from` at progress 0", () => {
    expect(interpolateViewportTransform(from, to, 0)).toEqual(from);
  });

  it("returns `to` at progress 1", () => {
    expect(interpolateViewportTransform(from, to, 1)).toEqual(to);
  });

  it("clamps beyond-end progress to `to` (the camera rests after the move)", () => {
    expect(interpolateViewportTransform(from, to, 42)).toEqual(to);
  });

  it("applies the ease to every component consistently", () => {
    const eased = cameraEase(0.5);
    const mid = interpolateViewportTransform(from, to, 0.5);
    expect(mid.scale).toBeCloseTo(1 + 0.5 * eased, 10);
    expect(mid.x).toBeCloseTo(-200 * eased, 10);
    expect(mid.y).toBeCloseTo(-120 * eased, 10);
  });

  it("is an identity when from and to are equal", () => {
    for (const p of [0, 0.3, 0.7, 1]) {
      expect(
        interpolateViewportTransform(
          VIEWPORT_TRANSFORM_IDENTITY,
          VIEWPORT_TRANSFORM_IDENTITY,
          p,
        ),
      ).toEqual(VIEWPORT_TRANSFORM_IDENTITY);
    }
  });

  it("VIEWPORT_CAMERA_AT_REST holds the identity at any time", () => {
    const { from: f, to: t } = VIEWPORT_CAMERA_AT_REST;
    expect(interpolateViewportTransform(f, t, 0.5)).toEqual(VIEWPORT_TRANSFORM_IDENTITY);
  });
});
