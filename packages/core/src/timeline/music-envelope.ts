import type { NarrationManifest } from "../narration/types.js";
import {
  DUCKING_VOLUME_DEFAULT,
  MUSIC_VOLUME_DEFAULT,
  type Soundtrack,
} from "../scenario/soundtrack.js";
import { computeStepTimeline } from "./compute-step-timeline.js";

/**
 * Milliseconds over which the music fades in from silence at scenario
 * start. Long enough to feel intentional, short enough that the opening
 * step is never dry.
 */
export const MUSIC_FADE_IN_MS = 1_000;

/**
 * Milliseconds over which the music fades out at the end of the
 * scenario. Matches the final-dwell window the timeline already reserves
 * after the last step, so the video never ends on a hard musical cut.
 */
export const MUSIC_FADE_OUT_MS = 3_000;

/**
 * Milliseconds the music takes to ramp between its base level and its
 * ducked level at each narration boundary. The ramp completes as the
 * voice starts (pre-duck) so narration onset is never fighting the ramp;
 * felt, not heard as a cut.
 */
export const DUCKING_RAMP_MS = 300;

/** A span of the scenario timeline during which a narration clip plays. */
export interface DuckingWindow {
  readonly startMs: number;
  readonly endMs: number;
}

/**
 * Everything needed to compute the music level at any point on the
 * scenario timeline. Precomputed once per scenario; `musicGainAt` reads
 * it per sample/frame without allocating.
 */
export interface MusicEnvelope {
  /** Resolved base music level (0–1). */
  readonly musicVolume: number;
  /** Resolved ducked music level while narration plays (0–1). */
  readonly duckingVolume: number;
  /** Total scenario duration, from `computeStepTimeline`. */
  readonly totalDurationMs: number;
  /** Narration clip spans on the timeline, in step order. */
  readonly duckingWindows: readonly DuckingWindow[];
}

/**
 * Precompute the music envelope for a scenario: resolved volume levels
 * plus the narration windows the music ducks under.
 *
 * The windows derive from the same `computeStepTimeline` both output
 * paths already share — a clip for step N spans from that step's start
 * for the clip's duration — so ducking agrees with narration placement
 * by construction, in browser playback and video export alike.
 */
export function computeMusicEnvelope(
  steps: readonly { delayMs: number }[],
  manifest: NarrationManifest | null | undefined,
  soundtrack: Soundtrack,
): MusicEnvelope {
  const { stepStartTimesMs, totalDurationMs } = computeStepTimeline(steps, manifest);

  const duckingWindows: DuckingWindow[] = [];
  if (manifest) {
    for (let i = 0; i < steps.length; i++) {
      const durationMs = manifest.steps[i]?.durationMs ?? 0;
      if (durationMs > 0) {
        const startMs = stepStartTimesMs[i] ?? 0;
        duckingWindows.push({ startMs, endMs: startMs + durationMs });
      }
    }
  }

  return {
    musicVolume: soundtrack.musicVolume ?? MUSIC_VOLUME_DEFAULT,
    duckingVolume: soundtrack.duckingVolume ?? DUCKING_VOLUME_DEFAULT,
    totalDurationMs,
    duckingWindows,
  };
}

/**
 * The music level at a point on the scenario timeline (0–1).
 *
 * Composed of three factors:
 * - a fade-in from silence over {@link MUSIC_FADE_IN_MS} at the start,
 * - a fade-out to silence over {@link MUSIC_FADE_OUT_MS} at the end,
 * - narration ducking: at the base level away from narration, at the
 *   ducked level while a clip plays, ramping over {@link DUCKING_RAMP_MS}
 *   into each window (completing at voice onset) and out after it ends.
 *
 * Pure and allocation-free: the browser applies it through Web Audio
 * gain automation, video export as a per-frame volume function. Outside
 * the scenario ([0, totalDurationMs]) the level is 0.
 */
export function musicGainAt(envelope: MusicEnvelope, timeMs: number): number {
  const { musicVolume, duckingVolume, totalDurationMs, duckingWindows } = envelope;
  if (timeMs < 0 || timeMs > totalDurationMs) return 0;

  // Ducked-ness in [0, 1]: 0 at the base level, 1 fully ducked. Overlapping
  // windows take the deepest value.
  let ducked = 0;
  for (const window of duckingWindows) {
    const rampInStart = window.startMs - DUCKING_RAMP_MS;
    if (timeMs < rampInStart || timeMs > window.endMs + DUCKING_RAMP_MS) continue;

    let d: number;
    if (timeMs < window.startMs) {
      d = (timeMs - rampInStart) / DUCKING_RAMP_MS;
    } else if (timeMs <= window.endMs) {
      d = 1;
    } else {
      d = 1 - (timeMs - window.endMs) / DUCKING_RAMP_MS;
    }
    if (d > ducked) ducked = d;
    if (ducked === 1) break;
  }

  const level = musicVolume + (duckingVolume - musicVolume) * ducked;

  const fadeIn = Math.min(1, timeMs / MUSIC_FADE_IN_MS);
  const fadeOut = Math.min(1, (totalDurationMs - timeMs) / MUSIC_FADE_OUT_MS);

  return level * fadeIn * fadeOut;
}
