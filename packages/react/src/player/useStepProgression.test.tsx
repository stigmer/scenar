import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { type ScenarioStep, computeStepTimeline } from "@scenar/core";
import { useStepProgression } from "./useStepProgression.js";

// Three steps at [0, 4000, 8000]ms, 12s total (delayMs is the wait before
// advancing past each step; muted, so narration never affects timing).
const STEPS = [
  { delayMs: 0 },
  { delayMs: 4_000 },
  { delayMs: 4_000 },
] as unknown as ScenarioStep<unknown>[];

const TIMELINE = computeStepTimeline(STEPS, null);

function renderProgression() {
  return renderHook(() =>
    useStepProgression({
      steps: STEPS,
      narrationManifest: undefined,
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
