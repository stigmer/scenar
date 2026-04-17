import type { NarrationManifest } from "../narration/types.js";
import type { ScenarioStep } from "../scenario/types.js";

/** Fallback duration for the last step when no narration exists. */
const LAST_STEP_FALLBACK_MS = 3000;

/**
 * Compute the effective duration of a step for interaction timing.
 *
 * Uses the narration clip duration if available. Falls back to the
 * next step's `delayMs` (since the next step's delay is the time
 * until it appears, which equals the current step's screen time).
 * For the last step, falls back to {@link LAST_STEP_FALLBACK_MS}.
 */
export function getStepDurationMs<T>(
  stepIndex: number,
  manifest: NarrationManifest | undefined,
  steps: readonly ScenarioStep<T>[],
): number {
  const narrationMs = manifest?.steps[stepIndex]?.durationMs;
  if (narrationMs != null && narrationMs > 0) return narrationMs;

  const nextStep = steps[stepIndex + 1];
  return nextStep ? nextStep.delayMs : LAST_STEP_FALLBACK_MS;
}
