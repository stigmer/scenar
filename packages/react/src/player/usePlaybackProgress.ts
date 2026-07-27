import { type RefObject, useCallback, useEffect, useRef } from "react";
import type { StepTimeline } from "@scenar/core";
import { formatTimeLabel, type TimeDisplayMode } from "./format-playback-time.js";

/**
 * Optional display surfaces driven by the progress loop, beyond the bar
 * itself. All fields are optional so the original ten-argument call keeps
 * working unchanged (this hook is public API).
 */
export interface PlaybackProgressDisplay {
  /**
   * Element that receives the formatted transport readout (`0:12 / 1:04` or
   * `-0:52`) via `textContent`. Written only when the displayed string
   * changes — never per frame — and rendered childless by the consumer so
   * React reconciliation never fights the manual writes.
   */
  timeLabelRef?: RefObject<HTMLElement | null>;
  /** Which quantity the readout shows. Defaults to `"elapsed"`. */
  timeDisplayMode?: TimeDisplayMode;
  /**
   * True while the viewer drags the scrubber. Suspends every DOM write this
   * hook makes so the drag preview (written by ScenarioControls to the same
   * refs) is the single writer during the gesture.
   */
  scrubbingRef?: RefObject<boolean>;
}

/**
 * RAF-driven progress bar animation.
 *
 * Produces a 0–1 progress value and applies it directly to two DOM
 * refs (progress track + playhead) at 60 fps, bypassing React state
 * to avoid per-frame re-renders. The optional time label rides the
 * same loop and is written only on whole-second (or mode) changes.
 *
 * `seekOffsetRef` and `seekGeneration` support continuous seek: when
 * the user clicks the progress bar, `seekToTime` populates the ref
 * with the intra-step elapsed time and bumps the generation. This
 * effect reads the offset instead of zeroing, so the bar lands at
 * the exact click position.
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
  seekOffsetRef: RefObject<number>,
  seekGeneration: number,
  display?: PlaybackProgressDisplay,
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

  const timeLabelRef = display?.timeLabelRef;
  const scrubbingRef = display?.scrubbingRef;
  const timeDisplayMode = display?.timeDisplayMode ?? "elapsed";
  const timeDisplayModeRef = useRef(timeDisplayMode);
  timeDisplayModeRef.current = timeDisplayMode;

  // Change detection for the label: the loop runs per frame, but the DOM is
  // only touched when the rendered string actually changes.
  const lastLabelRef = useRef("");
  // Last fraction written, so a mode toggle can re-render the label at the
  // current position without waiting for the next frame or state change.
  const lastFractionRef = useRef(0);

  const setProgressDOM = useCallback(
    (fraction: number) => {
      // During a scrub the controls own these DOM nodes (drag preview);
      // a second writer per frame would make the playhead fight the pointer.
      if (scrubbingRef?.current) return;
      const clamped = Math.max(0, Math.min(fraction, 1));
      lastFractionRef.current = clamped;
      const pct = `${clamped * 100}%`;
      if (progressTrackRef.current) progressTrackRef.current.style.width = pct;
      if (playheadRef.current) playheadRef.current.style.left = pct;
      if (timeLabelRef?.current) {
        const tl = stepTimelineRef.current;
        const label = formatTimeLabel(
          clamped * tl.totalDurationMs,
          tl.totalDurationMs,
          timeDisplayModeRef.current,
        );
        if (label !== lastLabelRef.current) {
          lastLabelRef.current = label;
          timeLabelRef.current.textContent = label;
        }
      }
    },
    [progressTrackRef, playheadRef, timeLabelRef, scrubbingRef],
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
    stepElapsedRef.current = seekOffsetRef.current;
    seekOffsetRef.current = 0;
    lastTickRef.current = performance.now();
  }, [stepIndex, seekGeneration, seekOffsetRef]);

  // Re-render the label at the current position when the display mode
  // toggles (elapsed ↔ remaining). Clearing the change-detection cache
  // forces the write even though the fraction is unchanged. Also runs on
  // mount, giving the label its initial content before the first frame.
  useEffect(() => {
    lastLabelRef.current = "";
    setProgressDOM(lastFractionRef.current);
  }, [timeDisplayMode, setProgressDOM]);

  // `stepTimeline` is a dependency (not read through the ref-mirror alone):
  // muting toggles narration in and out of the timeline, changing both the
  // total duration and the current fraction while paused — the bar and label
  // must reposition without a frame tick. `seekGeneration` covers intra-step
  // seeks while paused (same step index, new offset).
  useEffect(() => {
    if (playbackState === "idle") {
      setProgressDOM(0);
      return;
    }
    if (playbackState === "paused") {
      const idx = stepIndexRef.current;
      const stepStart = stepTimeline.stepStartTimesMs[idx] ?? 0;
      const stepEnd =
        idx < lastIndex
          ? (stepTimeline.stepStartTimesMs[idx + 1] ?? stepTimeline.totalDurationMs)
          : stepTimeline.totalDurationMs;
      const stepDuration = Math.max(stepEnd - stepStart, 1);
      const inStepFrac = Math.min(stepElapsedRef.current / stepDuration, 1);
      const progress = (stepStart + inStepFrac * (stepEnd - stepStart)) / stepTimeline.totalDurationMs;
      setProgressDOM(progress);
    }
  }, [playbackState, stepIndex, seekGeneration, lastIndex, stepTimeline, setProgressDOM]);
}
