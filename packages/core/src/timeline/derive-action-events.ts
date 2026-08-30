import {
  CLICK_DELAY_MS,
  DRAG_SETTLE_MS,
  HOVER_HOLD_MS,
  TYPE_CHAR_DELAY_MS,
} from "../timing/constants.js";
import type { StepAction } from "../scenario/step-action.js";

/**
 * The observable sub-events of a step interaction, in the vocabulary the
 * engine's effect layer uses: a `click` action is a cursor move followed
 * by a click dispatch; a `type` action is a cursor move followed by one
 * keystroke per character; and so on.
 */
export type ActionEventKind =
  | "cursor-move"
  | "click-dispatch"
  | "keystroke"
  | "hover-enter"
  | "hover-leave"
  | "drag-press"
  | "drag-move"
  | "drag-release"
  | "viewport-transition"
  | "simple-dispatch";

/** One timed sub-event of a step interaction. */
export interface ActionEvent {
  readonly kind: ActionEventKind;
  /**
   * When this event fires, in milliseconds relative to the step's entry,
   * at playback rate 1. Consumers scale for playback rate (the browser
   * scheduler divides by rate; video export always runs at rate 1).
   */
  readonly offsetMs: number;
  /** Zero-based character index. Present only on `keystroke` events. */
  readonly charIndex?: number;
}

/**
 * Derive the timed sub-events of a single step interaction — the
 * canonical statement of the engine's event-offset math.
 *
 * The offsets below are the exact times at which the interaction
 * schedulers in `@scenar/react` (`useBrowserStepInteractions`,
 * `useTimeSourceStepInteractions`) dispatch their effects; parity tests
 * in that package pin the schedulers to this derivation. Sound-effect
 * placement (`deriveSfxTimeline`) is built on it, so a sound can never
 * drift from the visual it accompanies.
 *
 * Pure function of its arguments: same action and duration, same events,
 * in both browser playback and video export.
 *
 * @param action - The interaction to derive events for.
 * @param stepDurationMs - The step's effective duration (see
 *   `getStepDurationMs`); `atPercent` anchors against it.
 */
export function deriveActionEvents(
  action: StepAction,
  stepDurationMs: number,
): ActionEvent[] {
  const fireAt = action.atPercent * stepDurationMs;

  switch (action.type) {
    case "click":
      return [
        { kind: "cursor-move", offsetMs: fireAt },
        { kind: "click-dispatch", offsetMs: fireAt + CLICK_DELAY_MS },
      ];

    case "type": {
      const text = action.text ?? "";
      // An empty type action is a no-op in the schedulers (not even a
      // cursor move), so it derives no events.
      if (text.length === 0) return [];
      const charDelay = action.typeDelay ?? TYPE_CHAR_DELAY_MS;
      const typingStart = fireAt + CLICK_DELAY_MS;
      const events: ActionEvent[] = [{ kind: "cursor-move", offsetMs: fireAt }];
      for (let i = 0; i < text.length; i++) {
        events.push({
          kind: "keystroke",
          offsetMs: typingStart + i * charDelay,
          charIndex: i,
        });
      }
      return events;
    }

    case "hover": {
      const holdMs = action.hoverDuration ?? HOVER_HOLD_MS;
      return [
        { kind: "cursor-move", offsetMs: fireAt },
        { kind: "hover-enter", offsetMs: fireAt + CLICK_DELAY_MS },
        { kind: "hover-leave", offsetMs: fireAt + CLICK_DELAY_MS + holdMs },
      ];
    }

    case "drag":
      return [
        { kind: "cursor-move", offsetMs: fireAt },
        { kind: "drag-press", offsetMs: fireAt + CLICK_DELAY_MS },
        { kind: "drag-move", offsetMs: fireAt + CLICK_DELAY_MS + DRAG_SETTLE_MS },
        {
          kind: "drag-release",
          offsetMs: fireAt + CLICK_DELAY_MS + DRAG_SETTLE_MS + CLICK_DELAY_MS,
        },
      ];

    case "viewport_transition":
      return [{ kind: "viewport-transition", offsetMs: fireAt }];

    // scroll_to, set_cursor, clear_cursor: a single dispatch at fireAt.
    default:
      return [{ kind: "simple-dispatch", offsetMs: fireAt }];
  }
}
