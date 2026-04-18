import { useMemo } from "react";
import {
  type NarrationManifest,
  type ScenarioStep,
  type StepTimeline,
  computeStepTimeline,
} from "@scenar/core";

export interface AudioClip {
  /** Step index this clip belongs to. */
  stepIndex: number;
  /** Asset path from the narration manifest (e.g. "/demos/foo/step-0.mp3"). */
  src: string;
  /** Remotion frame where this clip starts. */
  startFrame: number;
  /** Duration of this clip in Remotion frames. */
  durationFrames: number;
}

export interface ScenarioTimeline extends StepTimeline {
  /** Total video duration in Remotion frames at the given FPS. */
  durationInFrames: number;
  /** Start frame of each step (for Remotion Sequence positioning). */
  stepStartFrames: number[];
  /** Narration audio clips with frame offsets for Remotion Audio. */
  audioClips: AudioClip[];
  /** Frames per second used for the conversion. */
  fps: number;
}

function msToFrames(ms: number, fps: number): number {
  return Math.round((ms * fps) / 1000);
}

/**
 * Pre-compute a deterministic playback timeline with Remotion frame
 * offsets.  Delegates ms-level computation to the shared
 * `computeStepTimeline` utility (same math as browser playback).
 *
 * Ported from Stigmer's `video/lib/timeline.ts` — same conversion
 * logic, same `Math.round` rounding for frame alignment.
 */
function buildTimeline(
  steps: readonly ScenarioStep<unknown>[],
  narrationManifest: NarrationManifest | null | undefined,
  fps: number,
): ScenarioTimeline {
  const { stepStartTimesMs, totalDurationMs } = computeStepTimeline(
    steps,
    narrationManifest,
  );

  const stepStartFrames = stepStartTimesMs.map((ms) => msToFrames(ms, fps));
  const durationInFrames = msToFrames(totalDurationMs, fps);

  const audioClips: AudioClip[] = [];
  if (narrationManifest) {
    for (let i = 0; i < narrationManifest.steps.length; i++) {
      const entry = narrationManifest.steps[i];
      if (!entry) continue;
      audioClips.push({
        stepIndex: i,
        src: entry.src,
        startFrame: stepStartFrames[i] ?? 0,
        durationFrames: msToFrames(entry.durationMs, fps),
      });
    }
  }

  return {
    stepStartTimesMs,
    stepStartFrames,
    audioClips,
    totalDurationMs,
    durationInFrames,
    fps,
  };
}

/**
 * Convert Scenar's millisecond-based step timeline into Remotion frame
 * counts.  The returned values are stable across renders for the same
 * inputs.
 *
 * Use inside a Remotion component that needs timeline data.
 */
export function useScenarioTimeline(
  steps: readonly ScenarioStep<unknown>[],
  narrationManifest: NarrationManifest | null | undefined,
  fps: number,
): ScenarioTimeline {
  return useMemo(
    () => buildTimeline(steps, narrationManifest, fps),
    [steps, narrationManifest, fps],
  );
}

/**
 * Pure-function variant for use outside React (e.g. `calculateMetadata`,
 * CLI render scripts, `<Composition>` durationInFrames).
 */
export function calculateScenarioTimeline(
  steps: readonly ScenarioStep<unknown>[],
  narrationManifest: NarrationManifest | null | undefined,
  fps: number,
): ScenarioTimeline {
  return buildTimeline(steps, narrationManifest, fps);
}
