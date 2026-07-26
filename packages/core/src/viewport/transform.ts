/** Viewport transform state produced by step interactions. */
export interface ViewportTransform {
  scale: number;
  x: number;
  y: number;
}

/** The identity transform — no zoom, no translation. */
export const VIEWPORT_TRANSFORM_IDENTITY: Readonly<ViewportTransform> = {
  scale: 1,
  x: 0,
  y: 0,
};

/**
 * A camera move: the transform it started `from`, the transform it is
 * heading `to`, and the timeline instant the move fired at.
 *
 * Both output paths derive the same visual from this one value: browser
 * playback tweens toward `to` with {@link cameraEase} over
 * {@link CAMERA_TRANSITION_MS}; video export computes the exact
 * intermediate transform for any frame with
 * {@link interpolateViewportTransform} — same curve, same duration,
 * zero drift.
 */
export interface ViewportCameraMove {
  readonly from: ViewportTransform;
  readonly to: ViewportTransform;
  /** Timeline time (ms) the move fired at, in the scenario's time domain. */
  readonly atTimeMs: number;
}

/** A camera resting at the identity transform since t=0. */
export const VIEWPORT_CAMERA_AT_REST: Readonly<ViewportCameraMove> = {
  from: VIEWPORT_TRANSFORM_IDENTITY,
  to: VIEWPORT_TRANSFORM_IDENTITY,
  atTimeMs: 0,
};

/**
 * The camera's deceleration curve (ease-out quint).
 *
 * A camera move commits fast and glides to a stop — it must never
 * overshoot, because overshoot reads as a zoom *effect* rather than a
 * camera. Referentially transparent so browser playback (as a tween
 * easing) and video export (via {@link interpolateViewportTransform})
 * share one implementation.
 */
export function cameraEase(progress: number): number {
  const t = Math.min(1, Math.max(0, progress));
  return 1 - (1 - t) ** 5;
}

/**
 * The intermediate transform of a camera move at linear progress
 * `progress` (0..1, clamped). Applies {@link cameraEase}, then
 * interpolates each component. Pure — the video-export path calls this
 * per frame.
 */
export function interpolateViewportTransform(
  from: ViewportTransform,
  to: ViewportTransform,
  progress: number,
): ViewportTransform {
  // Exact endpoint, not `from + (to - from) * 1`: floating point does not
  // guarantee that expression returns `to`, and a camera at rest must land
  // on the authored transform bit-for-bit (consumers compare identity).
  if (progress >= 1) return { ...to };
  const eased = cameraEase(progress);
  return {
    scale: from.scale + (to.scale - from.scale) * eased,
    x: from.x + (to.x - from.x) * eased,
    y: from.y + (to.y - from.y) * eased,
  };
}
