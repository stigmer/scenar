import { type RefObject, useCallback, useEffect, useRef } from "react";
import type { StepTimeline } from "@scenar/core";

/**
 * RAF-driven progress bar animation.
 *
 * Produces a 0–1 progress value and applies it directly to two DOM
 * refs (progress track + playhead) at 60 fps, bypassing React state
 * to avoid per-frame re-renders.
 */
export function usePlaybackProgress(
  playing: boolean,
  playbackState: "idle" | "playing" | "paused",
  stepIndex: number,
  lastIndex: number,
  playbackRate: number,
  stepTimeline: StepTimeline,
  progressTrackRef: RefObject<HTMLDivElement | null>,
  playheadRef: RefObject<HTMLDivElement | null>,
): void {
  const rafRef = useRef(0);
  const stepElapsedRef = useRef(0);
  const lastTickRef = useRef(0);

  const stepTimelineRef = useRef(stepTimeline);
  stepTimelineRef.current = stepTimeline;

  const stepIndexRef = useRef(stepIndex);
  stepIndexRef.current = stepIndex;

  const rateRef = useRef(Math.max(playbackRate, 0.25));
  rateRef.current = Math.max(playbackRate, 0.25);

  const setProgressDOM = useCallback(
    (fraction: number) => {
      const pct = `${Math.max(0, Math.min(fraction, 1)) * 100}%`;
      if (progressTrackRef.current) progressTrackRef.current.style.width = pct;
      if (playheadRef.current) playheadRef.current.style.left = pct;
    },
    [progressTrackRef, playheadRef],
  );

  const tickFnRef = useRef<() => void>(undefined);
  tickFnRef.current = () => {
    const now = performance.now();
    stepElapsedRef.current += (now - lastTickRef.current) * rateRef.current;
    lastTickRef.current = now;

    const tl = stepTimelineRef.current;
    const idx = stepIndexRef.current;
    const stepStart = tl.stepStartTimesMs[idx] ?? 0;
    const stepEnd =
      idx < lastIndex ? (tl.stepStartTimesMs[idx + 1] ?? tl.totalDurationMs) : tl.totalDurationMs;
    const stepDuration = Math.max(stepEnd - stepStart, 1);
    const inStepFrac = Math.min(stepElapsedRef.current / stepDuration, 1);
    const progress = (stepStart + inStepFrac * (stepEnd - stepStart)) / tl.totalDurationMs;

    setProgressDOM(progress);
    rafRef.current = requestAnimationFrame(() => tickFnRef.current?.());
  };

  useEffect(() => {
    if (playing) {
      lastTickRef.current = performance.now();
      rafRef.current = requestAnimationFrame(() => tickFnRef.current?.());
    } else {
      cancelAnimationFrame(rafRef.current);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing]);

  useEffect(() => {
    stepElapsedRef.current = 0;
    lastTickRef.current = performance.now();
  }, [stepIndex]);

  useEffect(() => {
    if (playbackState === "idle") {
      setProgressDOM(0);
      return;
    }
    if (playbackState === "paused") {
      const tl = stepTimelineRef.current;
      const idx = stepIndexRef.current;
      const stepStart = tl.stepStartTimesMs[idx] ?? 0;
      const stepEnd =
        idx < lastIndex
          ? (tl.stepStartTimesMs[idx + 1] ?? tl.totalDurationMs)
          : tl.totalDurationMs;
      const stepDuration = Math.max(stepEnd - stepStart, 1);
      const inStepFrac = Math.min(stepElapsedRef.current / stepDuration, 1);
      const progress = (stepStart + inStepFrac * (stepEnd - stepStart)) / tl.totalDurationMs;
      setProgressDOM(progress);
    }
  }, [playbackState, stepIndex, lastIndex, setProgressDOM]);
}
