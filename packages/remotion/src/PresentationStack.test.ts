import { describe, expect, it } from "vitest";
import { computeContainFit } from "./PresentationStack.js";

/**
 * The contain-fit math is the presentation stack's one piece of geometry:
 * a single uniform scale factor (DD-008 — the frame boundary owns the only
 * scale), centered margins on the shorter axis.
 */
describe("computeContainFit", () => {
  it("pillarboxes a 16:10 canonical box in a 16:9 frame (the render default)", () => {
    const fit = computeContainFit(1920, 1080, 1440, 900);
    expect(fit.scale).toBeCloseTo(1080 / 900); // height-limited: 1.2
    expect(fit.offsetY).toBe(0);
    expect(fit.offsetX).toBeCloseTo((1920 - 1440 * 1.2) / 2); // 96px pillars
  });

  it("letterboxes a wide box in a tall frame", () => {
    const fit = computeContainFit(1080, 1920, 1440, 900);
    expect(fit.scale).toBeCloseTo(1080 / 1440); // width-limited: 0.75
    expect(fit.offsetX).toBe(0);
    expect(fit.offsetY).toBeCloseTo((1920 - 900 * 0.75) / 2);
  });

  it("is the identity when the box matches the frame", () => {
    const fit = computeContainFit(1440, 900, 1440, 900);
    expect(fit).toEqual({ scale: 1, offsetX: 0, offsetY: 0 });
  });

  it("scales up as well as down (a small box fills a large frame)", () => {
    const fit = computeContainFit(2880, 1800, 1440, 900);
    expect(fit).toEqual({ scale: 2, offsetX: 0, offsetY: 0 });
  });
});
