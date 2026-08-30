/**
 * The presenter frame's fade treatment, as a pure function of time —
 * so the browser player and the video export render the identical
 * fade from the same math (one implementation, both time domains).
 */

/**
 * Fade length at each end of a presenter clip, in milliseconds.
 *
 * The fade-in doubles as the swap treatment: it absorbs the measured
 * src-swap pop-in (≤133 ms worst case across browsers), so no
 * double-buffering machinery is needed. The fade-out is the exit
 * grammar — the presenter finishes and steps aside, rather than
 * freezing mid-gesture when the step outlives the clip.
 */
export const PRESENTER_FADE_MS = 200;

/**
 * The presenter frame's opacity at `intraStepMs` milliseconds into its
 * step, for a clip of `clipDurationMs`.
 *
 * Ramps 0→1 over the first {@link PRESENTER_FADE_MS}, holds 1, ramps
 * 1→0 over the last {@link PRESENTER_FADE_MS}, and is 0 outside the
 * clip (before its start, and for the remainder of a step that
 * outlives it). Clips shorter than two fades never reach full
 * opacity — the ramps intersect at the midpoint, keeping the curve
 * continuous.
 *
 * Reduced-motion is a consumer concern: the browser player hides the
 * presenter entirely under `prefers-reduced-motion`, and the export
 * has no such media query — neither needs a flag here.
 */
export function presenterOpacityAt(
  intraStepMs: number,
  clipDurationMs: number,
): number {
  if (clipDurationMs <= 0) return 0;
  if (intraStepMs <= 0 || intraStepMs >= clipDurationMs) return 0;

  const fadeIn = intraStepMs / PRESENTER_FADE_MS;
  const fadeOut = (clipDurationMs - intraStepMs) / PRESENTER_FADE_MS;
  return Math.min(fadeIn, fadeOut, 1);
}
