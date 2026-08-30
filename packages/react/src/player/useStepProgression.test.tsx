import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { type PresenterManifest, type ScenarioStep, computeStepTimeline } from "@scenar/core";
import { useStepProgression } from "./useStepProgression.js";

// Three steps at [0, 4000, 8000]ms, 12s total (delayMs is the wait before
// advancing past each step; muted, so narration never affects timing).
const STEPS = [
  { delayMs: 0 },
  { delayMs: 4_000 },
  { delayMs: 4_000 },
] as unknown as ScenarioStep<unknown>[];

const TIMELINE = computeStepTimeline(STEPS, null);

function renderProgression(presenterManifest?: PresenterManifest) {
  return renderHook(() =>
    useStepProgression({
      steps: STEPS,
      narrationManifest: undefined,
      presenterManifest,
      muted: true,
      playbackRate: 1,
      isVideoExport: false,
      prefersReducedMotion: false,
      onClipEnded: () => {},
    }),
  );
}

beforeEach(() => {
  // Step advancement schedules real timeouts; freeze them so playback state
  // only changes when a test says so.
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useStepProgression seek semantics", () => {
  it("keeps playing when seeking while playing", () => {
    const { result } = renderProgression();
    act(() => result.current.play());
    expect(result.current.playbackState).toBe("playing");

    act(() => result.current.seekToTime(6_000, TIMELINE));
    expect(result.current.playbackState).toBe("playing");
    expect(result.current.stepIndex).toBe(1);
    expect(result.current.seekOffsetRef.current).toBe(2_000);
  });

  it("stays paused on the target frame when seeking while paused", () => {
    const { result } = renderProgression();
    act(() => result.current.play());
    act(() => result.current.pause());
    expect(result.current.playbackState).toBe("paused");

    act(() => result.current.seekToTime(9_000, TIMELINE));
    expect(result.current.playbackState).toBe("paused");
    expect(result.current.stepIndex).toBe(2);
    expect(result.current.seekOffsetRef.current).toBe(1_000);
  });

  it("lands paused when seeking from idle (embed-bridge path)", () => {
    // The control bar is hidden while idle; only a host `seek` command can
    // reach this state. It must position the frame, not start playback the
    // viewer never asked for.
    const { result } = renderProgression();
    expect(result.current.playbackState).toBe("idle");

    act(() => result.current.seekToTime(4_500, TIMELINE));
    expect(result.current.playbackState).toBe("paused");
    expect(result.current.stepIndex).toBe(1);
  });

  it("clamps seeks beyond the timeline to its end", () => {
    const { result } = renderProgression();
    act(() => result.current.play());
    act(() => result.current.seekToTime(99_000, TIMELINE));
    expect(result.current.stepIndex).toBe(STEPS.length - 1);
    expect(result.current.seekOffsetRef.current).toBe(
      TIMELINE.totalDurationMs - TIMELINE.stepStartTimesMs[STEPS.length - 1]!,
    );
  });
});

describe("useStepProgression muted presenter timing (G2-2)", () => {
  // Clip on step 1 (6s — longer than the 4s advance delay) and on the
  // final step 2 (5s — the muted closing hold).
  const PRESENTER: PresenterManifest = {
    steps: [
      null,
      { src: "./step-1.mp4", durationMs: 6_000 },
      { src: "./step-2.mp4", durationMs: 5_000 },
    ],
  };

  it("waits max(delayMs, clipDurationMs) before leaving a muted presenter step", () => {
    const { result } = renderProgression(PRESENTER);
    act(() => result.current.play());

    // Step 0 has no clip: plain delay (4000ms) advances to step 1.
    act(() => vi.advanceTimersByTime(4_000));
    expect(result.current.stepIndex).toBe(1);

    // Step 1's clip runs 6000ms — at the plain 4000ms delay the clip is
    // still talking; the step must hold.
    act(() => vi.advanceTimersByTime(4_000));
    expect(result.current.stepIndex).toBe(1);

    // At the clip's end the step advances.
    act(() => vi.advanceTimersByTime(2_000));
    expect(result.current.stepIndex).toBe(2);
  });

  it("holds the final muted step for its clip before pausing", () => {
    const { result } = renderProgression(PRESENTER);
    act(() => result.current.play());
    act(() => vi.advanceTimersByTime(4_000)); // -> step 1
    act(() => vi.advanceTimersByTime(6_000)); // -> step 2 (final, 5s clip)
    expect(result.current.stepIndex).toBe(2);
    expect(result.current.playbackState).toBe("playing");

    act(() => vi.advanceTimersByTime(4_999));
    expect(result.current.playbackState).toBe("playing");

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.playbackState).toBe("paused");
  });

  it("matches the export timeline: muted advancement equals computeStepTimeline with the presenter manifest", () => {
    // Delta-1 invariant: the muted player computes its progress-bar
    // timeline from the presenter manifest, and the muted scheduler must
    // land step boundaries on exactly those times.
    const timeline = computeStepTimeline(STEPS, PRESENTER);
    const { result } = renderProgression(PRESENTER);
    act(() => result.current.play());

    act(() => vi.advanceTimersByTime(timeline.stepStartTimesMs[1]!));
    expect(result.current.stepIndex).toBe(1);

    act(() =>
      vi.advanceTimersByTime(
        timeline.stepStartTimesMs[2]! - timeline.stepStartTimesMs[1]!,
      ),
    );
    expect(result.current.stepIndex).toBe(2);
  });

  it("leaves scenarios without a presenter untouched (byte-identical timing)", () => {
    const { result } = renderProgression(undefined);
    act(() => result.current.play());

    act(() => vi.advanceTimersByTime(4_000));
    expect(result.current.stepIndex).toBe(1);
    act(() => vi.advanceTimersByTime(4_000));
    expect(result.current.stepIndex).toBe(2);
    // Final step without narration or clip pauses immediately.
    expect(result.current.playbackState).toBe("paused");
  });
});
