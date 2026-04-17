import { describe, expect, it } from "vitest";
import { computeStepTimeline } from "./compute-step-timeline.js";

describe("computeStepTimeline", () => {
  it("returns zero duration for a single step with no narration", () => {
    const tl = computeStepTimeline([{ delayMs: 0 }], null);
    expect(tl.stepStartTimesMs).toEqual([0]);
    expect(tl.totalDurationMs).toBe(3000);
  });

  it("uses delayMs when no narration manifest is provided", () => {
    const tl = computeStepTimeline(
      [{ delayMs: 0 }, { delayMs: 1000 }, { delayMs: 2000 }],
      null,
    );
    expect(tl.stepStartTimesMs).toEqual([0, 1000, 3000]);
    expect(tl.totalDurationMs).toBe(3000 + 3000);
  });

  it("uses narration duration when it exceeds delayMs", () => {
    const tl = computeStepTimeline(
      [{ delayMs: 0 }, { delayMs: 500 }, { delayMs: 500 }],
      { steps: [{ src: "a.mp3", durationMs: 2000 }, { src: "b.mp3", durationMs: 1000 }, null] },
    );
    // Step 1 starts after max(500, 2000) = 2000
    expect(tl.stepStartTimesMs[1]).toBe(2000);
    // Step 2 starts after 2000 + max(500, 1000) = 3000
    expect(tl.stepStartTimesMs[2]).toBe(3000);
  });

  it("uses delayMs when it exceeds narration duration", () => {
    const tl = computeStepTimeline(
      [{ delayMs: 0 }, { delayMs: 5000 }],
      { steps: [{ src: "a.mp3", durationMs: 1000 }, null] },
    );
    expect(tl.stepStartTimesMs[1]).toBe(5000);
  });

  it("handles null entries in the manifest", () => {
    const tl = computeStepTimeline(
      [{ delayMs: 0 }, { delayMs: 1000 }],
      { steps: [null, null] },
    );
    expect(tl.stepStartTimesMs).toEqual([0, 1000]);
  });

  it("uses last step narration for total duration when it exceeds dwell", () => {
    const tl = computeStepTimeline(
      [{ delayMs: 0 }, { delayMs: 1000 }],
      { steps: [null, { src: "b.mp3", durationMs: 5000 }] },
    );
    expect(tl.totalDurationMs).toBe(1000 + 5000);
  });

  it("handles empty steps array", () => {
    const tl = computeStepTimeline([], null);
    expect(tl.stepStartTimesMs).toEqual([0]);
    expect(tl.totalDurationMs).toBe(3000);
  });
});
