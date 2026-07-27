/**
 * Pure time formatting for the player's transport readout.
 *
 * Internal to the player (not part of the @scenar/react public API): the
 * readout is a presentation detail of ScenarioControls, and exporting it
 * would freeze a formatting choice into the package contract.
 */

/** Which quantity the transport readout shows. */
export type TimeDisplayMode = "elapsed" | "remaining";

/**
 * Format whole seconds as a video-player clock: `0:07`, `1:04`, `1:04:03`.
 * Hours appear only when non-zero; minutes pad to two digits only under an
 * hour field (`1:04:03` vs `4:03`), matching the convention viewers know.
 */
function formatSeconds(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`;
  return `${minutes}:${ss}`;
}

/**
 * Format a millisecond position as a clock string. Floors to the second —
 * a position only "reaches" a second once the full second has elapsed,
 * so the readout never runs ahead of the progress bar.
 */
export function formatPlaybackTime(ms: number): string {
  return formatSeconds(Math.floor(Math.max(0, ms) / 1000));
}

/**
 * Compose the full readout for the control bar.
 *
 * - `elapsed`: `0:12 / 1:04` (position floored, total floored — both sides
 *   use the same rounding so `elapsed === total` reads identically at the
 *   end of playback).
 * - `remaining`: `-0:52` (ceiled, so the countdown starts at the full
 *   duration and only shows `-0:00` at the exact end — a floor would show
 *   `-0:00` for the entire final second).
 */
export function formatTimeLabel(
  elapsedMs: number,
  totalMs: number,
  mode: TimeDisplayMode,
): string {
  if (mode === "remaining") {
    const remainingSeconds = Math.ceil(Math.max(0, totalMs - elapsedMs) / 1000);
    return `-${formatSeconds(remainingSeconds)}`;
  }
  return `${formatPlaybackTime(elapsedMs)} / ${formatPlaybackTime(totalMs)}`;
}
