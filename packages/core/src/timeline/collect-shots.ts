import type { StepTimeline } from "./compute-step-timeline.js";

/**
 * Minimal step shape for shot collection. Accepts any ScenarioStep<T>
 * without caring about the data payload.
 */
interface StepWithShot {
  delayMs: number;
  shot?: string;
}

/** A named still-capture point resolved to its position on the timeline. */
export interface ScenarioShot {
  /** The step's declared `shot` name (validated kebab-case, unique). */
  readonly name: string;
  /**
   * The capture time: the step's settled end. For step i this is
   * `stepStartTimesMs[i + 1] - 1`; for the final step it is
   * `totalDurationMs - 1`, which already includes the final dwell (or the
   * final narration clip, whichever is longer).
   */
  readonly timeMs: number;
  /** Index of the step that declared the shot. */
  readonly stepIndex: number;
}

/**
 * The shape a `shot` name must have. Each name becomes a filename
 * (`stills/<shot>.<theme>.png`) and a URL segment in the deployed bundle,
 * so the charset is deliberately the strict kebab-case subset of what the
 * deploy path contract admits.
 */
export const SHOT_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Resolve every `shot`-bearing step to its named capture point, in
 * timeline order.
 *
 * Throws on the two authoring mistakes that must never reach a deployed
 * bundle: a name that cannot be a clean filename/URL segment, and a
 * duplicate name (shots are addressed by name, never by index — a
 * collision would silently overwrite a still). Error messages name the
 * offending step index so the fix is local.
 *
 * The `timeline` must be computed from the same steps (and the same
 * narration manifest) the capture will walk — shot times are meaningless
 * against any other timeline.
 */
export function collectScenarioShots(
  steps: readonly StepWithShot[],
  timeline: StepTimeline,
): ScenarioShot[] {
  const shots: ScenarioShot[] = [];
  const seen = new Map<string, number>();

  for (let i = 0; i < steps.length; i++) {
    const name = steps[i]?.shot;
    if (name === undefined) continue;

    if (!SHOT_NAME_PATTERN.test(name)) {
      throw new Error(
        `step ${i} declares shot "${name}", which is not kebab-case ` +
          `(expected ${SHOT_NAME_PATTERN}); it becomes a filename and a URL segment`,
      );
    }
    const firstIndex = seen.get(name);
    if (firstIndex !== undefined) {
      throw new Error(
        `steps ${firstIndex} and ${i} both declare shot "${name}"; ` +
          `shot names must be unique within a scenario`,
      );
    }
    seen.set(name, i);

    const nextStartMs = timeline.stepStartTimesMs[i + 1];
    shots.push({
      name,
      timeMs: (nextStartMs ?? timeline.totalDurationMs) - 1,
      stepIndex: i,
    });
  }

  return shots;
}
