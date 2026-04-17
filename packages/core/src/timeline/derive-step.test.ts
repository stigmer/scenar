import { describe, expect, it } from "vitest";
import { deriveStepFromTime } from "./derive-step.js";

describe("deriveStepFromTime", () => {
  const starts = [0, 1000, 3000, 6000];
  const maxIndex = 3;

  it("returns 0 for time before all steps", () => {
    expect(deriveStepFromTime(-1, starts, maxIndex)).toBe(0);
  });

  it("returns 0 at time 0", () => {
    expect(deriveStepFromTime(0, starts, maxIndex)).toBe(0);
  });

  it("returns the correct step for times within each range", () => {
    expect(deriveStepFromTime(500, starts, maxIndex)).toBe(0);
    expect(deriveStepFromTime(1000, starts, maxIndex)).toBe(1);
    expect(deriveStepFromTime(2500, starts, maxIndex)).toBe(1);
    expect(deriveStepFromTime(3000, starts, maxIndex)).toBe(2);
    expect(deriveStepFromTime(6000, starts, maxIndex)).toBe(3);
    expect(deriveStepFromTime(99999, starts, maxIndex)).toBe(3);
  });

  it("clamps result to maxIndex", () => {
    expect(deriveStepFromTime(6000, starts, 1)).toBe(1);
  });

  it("returns 0 for empty start times", () => {
    expect(deriveStepFromTime(5000, [], 0)).toBe(0);
  });

  it("handles single step", () => {
    expect(deriveStepFromTime(0, [0], 0)).toBe(0);
    expect(deriveStepFromTime(5000, [0], 0)).toBe(0);
  });
});
