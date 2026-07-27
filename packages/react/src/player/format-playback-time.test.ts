import { describe, expect, it } from "vitest";
import { formatPlaybackTime, formatTimeLabel } from "./format-playback-time.js";

describe("formatPlaybackTime", () => {
  it.each([
    // [ms, expected]
    [0, "0:00"],
    [999, "0:00"], // floors: a second is only reached once fully elapsed
    [1_000, "0:01"],
    [7_499, "0:07"],
    [59_999, "0:59"],
    [60_000, "1:00"],
    [64_000, "1:04"],
    [599_000, "9:59"],
    [600_000, "10:00"],
    [3_599_000, "59:59"],
    [3_600_000, "1:00:00"], // hours appear only when non-zero
    [3_843_000, "1:04:03"], // minutes pad to two digits under an hour field
    [36_000_000, "10:00:00"],
  ] as const)("formats %ims as %s", (ms, expected) => {
    expect(formatPlaybackTime(ms)).toBe(expected);
  });

  it("clamps negative input to zero", () => {
    expect(formatPlaybackTime(-500)).toBe("0:00");
  });
});

describe("formatTimeLabel", () => {
  it.each([
    // [elapsedMs, totalMs, expected]
    [0, 64_000, "0:00 / 1:04"],
    [12_000, 64_000, "0:12 / 1:04"],
    [64_000, 64_000, "1:04 / 1:04"], // both sides share the floor, so end state reads identically
    [12_500, 64_500, "0:12 / 1:04"],
  ] as const)("elapsed mode: %ims of %ims → %s", (elapsedMs, totalMs, expected) => {
    expect(formatTimeLabel(elapsedMs, totalMs, "elapsed")).toBe(expected);
  });

  it.each([
    // [elapsedMs, totalMs, expected]
    [0, 64_000, "-1:04"], // countdown starts at the full duration
    [12_000, 64_000, "-0:52"],
    [63_001, 64_000, "-0:01"], // ceiled: -0:00 only appears at the exact end
    [64_000, 64_000, "-0:00"],
    [70_000, 64_000, "-0:00"], // over-run clamps
  ] as const)("remaining mode: %ims of %ims → %s", (elapsedMs, totalMs, expected) => {
    expect(formatTimeLabel(elapsedMs, totalMs, "remaining")).toBe(expected);
  });

  it("crosses the hour boundary in remaining mode", () => {
    expect(formatTimeLabel(0, 3_843_000, "remaining")).toBe("-1:04:03");
  });
});
