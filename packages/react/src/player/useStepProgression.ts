import { type MutableRefObject, useCallback, useEffect, useRef, useState } from "react";
import { type NarrationManifest, type ScenarioStep, type StepTimeline, deriveStepFromTime } from "@scenar/core";
import { useTimeSource } from "../time/TimeSource.js";

type PlaybackState = "idle" | "playing" | "paused";

interface UseStepProgressionOptions<T> {
  steps: ScenarioStep<T>[];
  narrationManifest: NarrationManifest | undefined;
  muted: boolean;
  playbackRate: number;
  isVideoExport: boolean;
  prefersReducedMotion: boolean | null;
  onClipEnded: () => void;
}

interface UseStepProgressionResult {
  stepIndex: number;
  playbackState: PlaybackState;
  playing: boolean;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  goTo: (index: number) => void;
  /**
   * Seek to an exact time position. Derives the correct step index,
   * stores the intra-step offset in `seekOffsetRef`, and resumes
   * playback (YouTube-style continuous seek).
   */
  seekToTime: (timeMs: number, stepTimeline: StepTimeline) => void;
  /**
   * Ref that holds the intra-step elapsed offset (ms) after a
   * `seekToTime` call. Consumed by `usePlaybackProgress` to position
   * the progress bar at the exact click point instead of the step start.
   */
  seekOffsetRef: MutableRefObject<number>;
  /**
   * Monotonically increasing counter bumped on each `seekToTime` call.
   * Allows `usePlaybackProgress` to re-sync even when the step index
   * does not change (intra-step seek).
   */
  seekGeneration: number;
  /** Invoke to signal that the current narration clip has finished playing. */
  handleClipEnded: () => void;
  /** Register a pending advance callback (used by narration clip-ended). */
  setPendingAdvance: (fn: (() => void) | null) => void;
  /** Notify the coordinator that this player started playing. */
  coordinatorId: string | undefined;
}

/**
 * Manages step advancement logic for ScenarioPlayer.
 *
 * In browser mode, steps advance via `setTimeout` chains using
 * `delayMs` and narration duration. In video-export mode, step
 * index is derived from the time source's `currentTimeMs`.
 */
export function useStepProgression<T>({
  steps,
  narrationManifest,
  muted,
  playbackRate,
  isVideoExport,
  prefersReducedMotion,
}: UseStepProgressionOptions<T>): UseStepProgressionResult {
  const timeSource = useTimeSource();
  const lastIndex = steps.length - 1;

  const [timerStepIndex, setStepIndex] = useState(() =>
    prefersReducedMotion ? lastIndex : 0,
  );
  const [playbackState, setPlaybackState] = useState<PlaybackState>(
    isVideoExport ? "playing" : "idle",
  );

  const playing = playbackState === "playing";

  const stepIndex = timeSource
    ? deriveStepFromTime(timeSource.currentTimeMs, timeSource.stepStartTimesMs, lastIndex)
    : timerStepIndex;

  const stepIndexRef = useRef(stepIndex);
  stepIndexRef.current = stepIndex;

  const pendingAdvanceRef = useRef<(() => void) | null>(null);

  const seekOffsetRef = useRef(0);
  const [seekGeneration, setSeekGeneration] = useState(0);

  const rateRef = useRef(Math.max(playbackRate, 0.25));
  rateRef.current = Math.max(playbackRate, 0.25);

  // Step advancement — timer-driven path
  useEffect(() => {
    if (timeSource || !playing || prefersReducedMotion) return;

    const r = rateRef.current;

    if (stepIndex >= lastIndex) {
      const finalNarrationMs =
        !muted && narrationManifest
          ? (narrationManifest.steps[stepIndex]?.durationMs ?? 0)
          : 0;

      if (finalNarrationMs > 0) {
        pendingAdvanceRef.current = () => setPlaybackState("paused");
        const safety = setTimeout(() => {
          pendingAdvanceRef.current = null;
          setPlaybackState("paused");
        }, (finalNarrationMs + 2000) / r);
        return () => {
          clearTimeout(safety);
          pendingAdvanceRef.current = null;
        };
      }

      setPlaybackState("paused");
      return;
    }

    const nextIndex = stepIndex + 1;
    const baseDelay = steps[nextIndex]!.delayMs / r;
    const narrationDuration =
      !muted && narrationManifest
        ? (narrationManifest.steps[stepIndex]?.durationMs ?? 0)
        : 0;

    if (narrationDuration > 0) {
      let clipDone = false;
      let baseDelayDone = false;
      let fired = false;

      const advance = () => {
        if (fired) return;
        fired = true;
        pendingAdvanceRef.current = null;
        setStepIndex(nextIndex);
      };

      const tryAdvance = () => {
        if (clipDone && baseDelayDone) advance();
      };

      pendingAdvanceRef.current = () => {
        clipDone = true;
        tryAdvance();
      };

      const baseTimer = setTimeout(() => {
        baseDelayDone = true;
        tryAdvance();
      }, baseDelay);

      const safetyTimer = setTimeout(
        advance,
        (Math.max(steps[nextIndex]!.delayMs, narrationDuration) + 2000) / r,
      );

      return () => {
        clearTimeout(baseTimer);
        clearTimeout(safetyTimer);
        pendingAdvanceRef.current = null;
      };
    }

    const timer = setTimeout(() => setStepIndex(nextIndex), baseDelay);
    return () => clearTimeout(timer);
  }, [timeSource, playing, stepIndex, steps, lastIndex, prefersReducedMotion, muted, narrationManifest]);

  const goTo = useCallback(
    (index: number) => {
      setPlaybackState("paused");
      setStepIndex(Math.max(0, Math.min(index, lastIndex)));
    },
    [lastIndex],
  );

  const seekToTime = useCallback(
    (timeMs: number, timeline: StepTimeline) => {
      const clamped = Math.max(0, Math.min(timeMs, timeline.totalDurationMs));
      const target = deriveStepFromTime(clamped, timeline.stepStartTimesMs, lastIndex);
      const stepStart = timeline.stepStartTimesMs[target] ?? 0;
      seekOffsetRef.current = clamped - stepStart;
      setStepIndex(target);
      setPlaybackState("playing");
      setSeekGeneration((g) => g + 1);
    },
    [lastIndex],
  );

  const play = useCallback(() => {
    if (stepIndexRef.current >= lastIndex) setStepIndex(0);
    setPlaybackState("playing");
  }, [lastIndex]);

  const pause = useCallback(() => {
    setPlaybackState("paused");
  }, []);

  const togglePlay = useCallback(() => {
    if (playing) pause();
    else play();
  }, [playing, play, pause]);

  const handleClipEnded = useCallback(() => {
    pendingAdvanceRef.current?.();
  }, []);

  const setPendingAdvance = useCallback((fn: (() => void) | null) => {
    pendingAdvanceRef.current = fn;
  }, []);

  return {
    stepIndex,
    playbackState,
    playing,
    play,
    pause,
    togglePlay,
    goTo,
    seekToTime,
    seekOffsetRef,
    seekGeneration,
    handleClipEnded,
    setPendingAdvance,
    coordinatorId: undefined,
  };
}
