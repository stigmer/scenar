import type { NarrationManifest } from "../narration/types.js";
import type { ScenarioStep } from "../scenario/types.js";
import { getStepDurationMs } from "./step-duration.js";
import { deriveActionEvents, type ActionEventKind } from "./derive-action-events.js";

/**
 * The engine's built-in sound-effect vocabulary. Deliberately minimal:
 * a click sound and a keystroke sound sell realism; everything else
 * (hover, scroll, camera moves) stays silent.
 */
export type SfxSound = "click" | "keystroke";

/** One sound effect placed on the scenario timeline. */
export interface SfxEvent {
  /** The step during which this sound fires. */
  readonly stepIndex: number;
  /**
   * When the sound fires, in milliseconds relative to the step's entry,
   * at playback rate 1 — the same time base as `ActionEvent.offsetMs`,
   * so the sound and the visual it accompanies share one clock.
   */
  readonly offsetMs: number;
  readonly sound: SfxSound;
}

/**
 * Which action sub-events make a sound. Click dispatches and drag
 * press/release share the click sound (a drag is a press and a release);
 * each typed character gets a keystroke sound.
 */
const SOUND_BY_EVENT_KIND: Partial<Record<ActionEventKind, SfxSound>> = {
  "click-dispatch": "click",
  "drag-press": "click",
  "drag-release": "click",
  keystroke: "keystroke",
};

/**
 * Derive every sound effect in the scenario from its interactions —
 * placement is computed, never authored.
 *
 * Built on `deriveActionEvents`, so each sound fires at the exact moment
 * its interaction dispatches: the click sound when the DOM click fires
 * (after the cursor's travel window), one keystroke sound per typed
 * character at the typing cadence, click sounds at drag press and
 * release. Consumers place the events: video export converts offsets to
 * absolute frames via the step timeline; browser playback schedules them
 * on step entry, exactly like the interaction schedulers.
 *
 * Events are ordered by step, then by offset within the step.
 */
export function deriveSfxTimeline<T>(
  steps: readonly ScenarioStep<T>[],
  manifest: NarrationManifest | undefined,
): SfxEvent[] {
  const events: SfxEvent[] = [];

  for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
    const actions = steps[stepIndex]?.interactions;
    if (!actions || actions.length === 0) continue;

    const duration = getStepDurationMs(stepIndex, manifest, steps);
    const stepEvents: SfxEvent[] = [];

    for (const action of actions) {
      for (const event of deriveActionEvents(action, duration)) {
        const sound = SOUND_BY_EVENT_KIND[event.kind];
        if (sound) {
          stepEvents.push({ stepIndex, offsetMs: event.offsetMs, sound });
        }
      }
    }

    stepEvents.sort((a, b) => a.offsetMs - b.offsetMs);
    events.push(...stepEvents);
  }

  return events;
}
