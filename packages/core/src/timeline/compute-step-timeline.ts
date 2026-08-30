import type { NarrationManifest } from "../narration/types.js";

/**
 * Minimal step shape for timeline computation. Accepts any
 * ScenarioStep<T> without caring about the data payload. The optional
 * `card` marker participates because a synthesized outro card's
 * duration IS the closing dwell (see below).
 */
interface StepTiming {
  delayMs: number;
  card?: { durationMs?: number };
}

/**
 * Dwell time on the final step so viewers can absorb the result.
 * Also the delay `applyTitleCards` gives a synthesized outro card, so
 * the last authored step keeps exactly this dwell before the card.
 */
export const FINAL_DWELL_MS = 3_000;

export interface StepTimeline {
  /** Start time of each step in milliseconds (index 0 is always 0). */
  stepStartTimesMs: number[];
  /** Total playback duration in milliseconds. */
  totalDurationMs: number;
}

/**
 * Pre-compute step start times and total duration from step definitions
 * and an optional narration manifest.
 *
 * Step N+1 starts after `max(steps[N+1].delayMs, manifest.steps[N].durationMs)` —
 * whichever is longer, the base delay or the narration clip for the current step.
 *
 * Shared between browser ScenarioPlayer (progress bar) and Remotion
 * video export (frame-based timeline).
 */
export function computeStepTimeline(
  steps: readonly StepTiming[],
  manifest: NarrationManifest | null | undefined,
): StepTimeline {
  const stepStartTimesMs: number[] = [0];

  for (let i = 1; i < steps.length; i++) {
    const prevStart = stepStartTimesMs[i - 1]!;
    const baseDelay = steps[i]!.delayMs;
    const narrationMs = manifest?.steps[i - 1]?.durationMs ?? 0;
    stepStartTimesMs.push(prevStart + Math.max(baseDelay, narrationMs));
  }

  const lastStepStart = stepStartTimesMs[stepStartTimesMs.length - 1] ?? 0;
  const lastNarrationMs = manifest?.steps[steps.length - 1]?.durationMs ?? 0;
  // A final card step (a synthesized outro) dwells for its configured
  // duration instead of the fixed default — cards are silent, so the
  // narration max is a no-op for them but kept for uniformity.
  const closingDwellMs = steps[steps.length - 1]?.card?.durationMs ?? FINAL_DWELL_MS;
  const totalDurationMs = lastStepStart + Math.max(closingDwellMs, lastNarrationMs);

  return { stepStartTimesMs, totalDurationMs };
}
