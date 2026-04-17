import { describe, expect, it } from "vitest";
import { getStepDurationMs } from "./step-duration.js";

describe("getStepDurationMs", () => {
  const steps = [
    { delayMs: 0, data: null },
    { delayMs: 1500, data: null },
    { delayMs: 2000, data: null },
  ];

  it("returns narration duration when manifest has an entry", () => {
    const manifest = {
      steps: [{ src: "a.mp3", durationMs: 4000 }, null, null],
    };
    expect(getStepDurationMs(0, manifest, steps)).toBe(4000);
  });

  it("falls back to next step delayMs when no narration", () => {
    expect(getStepDurationMs(0, undefined, steps)).toBe(1500);
    expect(getStepDurationMs(1, undefined, steps)).toBe(2000);
  });

  it("falls back to 3000 for the last step with no narration", () => {
    expect(getStepDurationMs(2, undefined, steps)).toBe(3000);
  });

  it("treats zero narration duration as missing", () => {
    const manifest = {
      steps: [{ src: "a.mp3", durationMs: 0 }, null, null],
    };
    expect(getStepDurationMs(0, manifest, steps)).toBe(1500);
  });

  it("handles null entries in manifest", () => {
    const manifest = { steps: [null, null, null] };
    expect(getStepDurationMs(0, manifest, steps)).toBe(1500);
  });
});
