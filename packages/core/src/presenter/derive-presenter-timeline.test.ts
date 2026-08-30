import { describe, expect, it } from "vitest";
import { computeStepTimeline } from "../timeline/compute-step-timeline.js";
import { deriveStepFromTime } from "../timeline/derive-step.js";
import { applyTitleCards } from "../scenario/apply-title-cards.js";
import type { ScenarioStep } from "../scenario/types.js";
import { derivePresenterTimeline } from "./derive-presenter-timeline.js";
import type { PresenterManifest } from "./types.js";

const step = (delayMs: number): ScenarioStep<null> => ({ delayMs, data: null });

const entry = (index: number, durationMs: number) => ({
  src: `./step-${index}.mp4`,
  durationMs,
});

describe("derivePresenterTimeline", () => {
  it("returns no windows without a manifest", () => {
    const timeline = computeStepTimeline([step(0), step(1000)], undefined);
    expect(derivePresenterTimeline(undefined, timeline)).toEqual([]);
  });

  it("returns no windows for an all-null manifest", () => {
    const timeline = computeStepTimeline([step(0), step(1000)], undefined);
    const manifest: PresenterManifest = { steps: [null, null] };
    expect(derivePresenterTimeline(manifest, timeline)).toEqual([]);
  });

  it("windows a clip on step 0 at time 0", () => {
    const timeline = computeStepTimeline([step(0), step(1000)], undefined);
    const manifest: PresenterManifest = { steps: [entry(0, 2500), null] };

    expect(derivePresenterTimeline(manifest, timeline)).toEqual([
      { stepIndex: 0, startMs: 0, clipDurationMs: 2500 },
    ]);
  });

  it("windows a clip on the last step at its start time", () => {
    const steps = [step(0), step(1000), step(800)];
    const manifest: PresenterManifest = { steps: [null, null, entry(2, 1500)] };
    // Step starts derive from narration-compatible durations too; keep
    // this delay-only so startMs is the plain prefix sum: 0, 1000, 1800.
    const timeline = computeStepTimeline(steps, undefined);

    expect(derivePresenterTimeline(manifest, timeline)).toEqual([
      { stepIndex: 2, startMs: 1800, clipDurationMs: 1500 },
    ]);
  });

  it("handles a single-step scenario", () => {
    const timeline = computeStepTimeline([step(0)], undefined);
    const manifest: PresenterManifest = { steps: [entry(0, 900)] };

    expect(derivePresenterTimeline(manifest, timeline)).toEqual([
      { stepIndex: 0, startMs: 0, clipDurationMs: 900 },
    ]);
  });

  it("windows every opted-in step and skips the rest", () => {
    const steps = [step(0), step(1000), step(1000), step(1000)];
    const manifest: PresenterManifest = {
      steps: [entry(0, 500), null, entry(2, 700), null],
    };
    const timeline = computeStepTimeline(steps, undefined);

    expect(derivePresenterTimeline(manifest, timeline)).toEqual([
      { stepIndex: 0, startMs: 0, clipDurationMs: 500 },
      { stepIndex: 2, startMs: 2000, clipDurationMs: 700 },
    ]);
  });

  it("ignores manifest entries beyond the timeline's steps (stale manifest degrades)", () => {
    const timeline = computeStepTimeline([step(0)], undefined);
    const manifest: PresenterManifest = {
      steps: [entry(0, 500), entry(1, 700)],
    };

    expect(derivePresenterTimeline(manifest, timeline)).toEqual([
      { stepIndex: 0, startMs: 0, clipDurationMs: 500 },
    ]);
  });

  it("aligns with card-padded manifests from applyTitleCards", () => {
    const authored: ScenarioStep<null>[] = [step(0), step(1500)];
    const narration = {
      steps: [
        { src: "./step-0.mp3", durationMs: 2000 },
        { src: "./step-1.mp3", durationMs: 1200 },
      ],
    };
    const presenter: PresenterManifest = {
      steps: [entry(0, 2000), null],
    };

    const applied = applyTitleCards(authored, narration, {
      intro: { title: "Acme", durationMs: 4000 },
      outro: { title: "Try it" },
    }, presenter);
    const timeline = computeStepTimeline(applied.steps, applied.narrationManifest);

    // The one opted-in authored step is now index 1 (after the intro),
    // starting when the intro's 4000ms card time elapses.
    expect(derivePresenterTimeline(applied.presenterManifest, timeline)).toEqual([
      { stepIndex: 1, startMs: 4000, clipDurationMs: 2000 },
    ]);
  });

  it("agrees with deriveStepFromTime: a window is active exactly while its step is", () => {
    const steps = [step(0), step(1000), step(3000)];
    const narration = {
      steps: [
        { src: "./step-0.mp3", durationMs: 2000 },
        null,
        { src: "./step-2.mp3", durationMs: 1500 },
      ],
    };
    // Presenter durations mirror narration durations (the CLI writes
    // them from the narration manifest), so windows fit their steps.
    const presenter: PresenterManifest = {
      steps: [entry(0, 2000), null, entry(2, 1500)],
    };
    const timeline = computeStepTimeline(steps, narration);
    const windows = derivePresenterTimeline(presenter, timeline);
    const lastIndex = steps.length - 1;

    for (const window of windows) {
      const samples = [
        window.startMs,
        window.startMs + window.clipDurationMs / 2,
        window.startMs + window.clipDurationMs - 1,
      ];
      for (const t of samples) {
        expect(deriveStepFromTime(t, timeline.stepStartTimesMs, lastIndex)).toBe(
          window.stepIndex,
        );
      }
    }
  });
});
