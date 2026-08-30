import type { StepTimeline } from "../timeline/compute-step-timeline.js";
import type { PresenterManifest } from "./types.js";

/**
 * One presenter clip's place on the scenario timeline: when it becomes
 * visible (its step's start) and how long it plays.
 *
 * A window never outlives its step — `scenar presenter` writes clip
 * durations from the narration manifest, and step timing already waits
 * for narration (`max(delayMs, narration duration)`), so the clip fits
 * by construction. When the step outlives the clip (a long `delayMs`),
 * the frame fades out at clip end (see `presenterOpacityAt`).
 */
export interface PresenterWindow {
  /** Index into the EXPANDED step list (same domain as `stepTimeline`). */
  readonly stepIndex: number;
  /** Clip start in scenario time — the step's start, in milliseconds. */
  readonly startMs: number;
  /** Clip length in milliseconds. */
  readonly clipDurationMs: number;
}

/**
 * Derive every presenter clip's timeline window from the (expanded,
 * card-padded) presenter manifest and the step timeline computed over
 * the same expanded steps.
 *
 * This is the one implementation both outputs consume: the browser
 * player uses windows for expected-position math in its drift
 * corrections; the video export converts `startMs` to frames for
 * Sequence placement. Pure function — same inputs, same windows, in
 * both time domains.
 *
 * Manifest entries beyond the timeline's step count are ignored (a
 * stale manifest degrades, exactly as narration does).
 */
export function derivePresenterTimeline(
  presenterManifest: PresenterManifest | undefined,
  stepTimeline: StepTimeline,
): readonly PresenterWindow[] {
  if (!presenterManifest) return [];

  const windows: PresenterWindow[] = [];
  for (let i = 0; i < stepTimeline.stepStartTimesMs.length; i++) {
    const entry = presenterManifest.steps[i];
    if (!entry) continue;
    windows.push({
      stepIndex: i,
      startMs: stepTimeline.stepStartTimesMs[i]!,
      clipDurationMs: entry.durationMs,
    });
  }
  return windows;
}
