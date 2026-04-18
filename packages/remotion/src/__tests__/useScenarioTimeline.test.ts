import { describe, it, expect } from "vitest";
import { calculateScenarioTimeline } from "../useScenarioTimeline.js";
import type { ScenarioStep, NarrationManifest } from "@scenar/core";

const steps: ScenarioStep<string>[] = [
  { delayMs: 0, data: "step-0" },
  { delayMs: 3000, data: "step-1" },
  { delayMs: 2000, data: "step-2" },
];

const manifest: NarrationManifest = {
  steps: [
    { src: "/audio/step-0.mp3", durationMs: 5000 },
    { src: "/audio/step-1.mp3", durationMs: 4000 },
    null,
  ],
};

describe("calculateScenarioTimeline", () => {
  it("computes durationInFrames from step delays at 30 fps", () => {
    const timeline = calculateScenarioTimeline(steps, null, 30);
    expect(timeline.fps).toBe(30);
    expect(timeline.durationInFrames).toBeGreaterThan(0);
    expect(timeline.stepStartTimesMs[0]).toBe(0);
  });

  it("includes stepStartFrames aligned with stepStartTimesMs", () => {
    const timeline = calculateScenarioTimeline(steps, manifest, 30);
    expect(timeline.stepStartFrames).toHaveLength(3);
    expect(timeline.stepStartFrames[0]).toBe(0);
    // step 1 at 5000ms → Math.round(5000 * 30 / 1000) = 150
    expect(timeline.stepStartFrames[1]).toBe(150);
  });

  it("accounts for narration durations when manifest is provided", () => {
    const withNarration = calculateScenarioTimeline(steps, manifest, 30);
    const withoutNarration = calculateScenarioTimeline(steps, null, 30);
    expect(withNarration.totalDurationMs).toBeGreaterThan(
      withoutNarration.totalDurationMs,
    );
  });

  it("step 1 starts after max(delayMs, narration duration of step 0)", () => {
    const timeline = calculateScenarioTimeline(steps, manifest, 30);
    // step 0 narration is 5000ms, step 1 delayMs is 3000ms → max(3000, 5000) = 5000
    expect(timeline.stepStartTimesMs[1]).toBe(5000);
  });

  it("step 2 starts after max(delayMs, narration duration of step 1)", () => {
    const timeline = calculateScenarioTimeline(steps, manifest, 30);
    // step 1 narration is 4000ms, step 2 delayMs is 2000ms → max(2000, 4000) = 4000
    expect(timeline.stepStartTimesMs[2]).toBe(5000 + 4000);
  });

  it("builds audioClips with correct frame offsets and durations", () => {
    const timeline = calculateScenarioTimeline(steps, manifest, 30);
    expect(timeline.audioClips).toHaveLength(2);

    expect(timeline.audioClips[0]!.stepIndex).toBe(0);
    expect(timeline.audioClips[0]!.src).toBe("/audio/step-0.mp3");
    expect(timeline.audioClips[0]!.startFrame).toBe(0);
    // 5000ms → Math.round(5000 * 30 / 1000) = 150 frames
    expect(timeline.audioClips[0]!.durationFrames).toBe(150);

    expect(timeline.audioClips[1]!.stepIndex).toBe(1);
    expect(timeline.audioClips[1]!.src).toBe("/audio/step-1.mp3");
    expect(timeline.audioClips[1]!.startFrame).toBe(150);
    // 4000ms → Math.round(4000 * 30 / 1000) = 120 frames
    expect(timeline.audioClips[1]!.durationFrames).toBe(120);
  });

  it("returns empty audioClips when no manifest", () => {
    const timeline = calculateScenarioTimeline(steps, null, 30);
    expect(timeline.audioClips).toHaveLength(0);
  });

  it("uses Math.round for frame conversion (matches Stigmer)", () => {
    const timeline = calculateScenarioTimeline(
      [{ delayMs: 0, data: "a" }, { delayMs: 1500, data: "b" }],
      null,
      30,
    );
    // 1500ms + 3000ms final dwell = 4500ms → Math.round(4500 * 30 / 1000) = 135 frames
    expect(timeline.durationInFrames).toBe(135);
  });

  it("returns correct fps value", () => {
    const timeline = calculateScenarioTimeline(steps, null, 60);
    expect(timeline.fps).toBe(60);
  });

  it("handles single-step scenario", () => {
    const timeline = calculateScenarioTimeline(
      [{ delayMs: 0, data: "only" }],
      null,
      30,
    );
    // Single step: 0 + 3000ms final dwell = 3000ms → Math.round(3000 * 30 / 1000) = 90 frames
    expect(timeline.durationInFrames).toBe(90);
    expect(timeline.stepStartTimesMs).toEqual([0]);
    expect(timeline.stepStartFrames).toEqual([0]);
  });
});
