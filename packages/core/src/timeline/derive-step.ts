/**
 * Find the active step for a given playback time by scanning the
 * pre-computed step start times in reverse. Returns `0` if the
 * time precedes all steps.
 */
export function deriveStepFromTime(
  currentTimeMs: number,
  stepStartTimesMs: readonly number[],
  maxIndex: number,
): number {
  for (let i = stepStartTimesMs.length - 1; i >= 0; i--) {
    if (currentTimeMs >= stepStartTimesMs[i]!) return Math.min(i, maxIndex);
  }
  return 0;
}
