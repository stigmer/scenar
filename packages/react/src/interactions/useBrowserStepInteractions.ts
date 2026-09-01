import { useEffect, useRef } from "react";
import {
  HOVER_HOLD_MS,
  TYPE_CHAR_DELAY_MS,
  deriveActionEvents,
  getStepDurationMs,
} from "@scenar/core";
import type { StepAction, UseStepInteractionsOptions } from "@scenar/core";
import type { InteractionContext } from "./context.js";
import { dispatchActionEvent } from "./dispatch-action-event.js";
import {
  warnIfDragExceedsStep,
  warnIfHoverExceedsStep,
  warnIfTypingExceedsStep,
  warnIfViewportTooCloseToAction,
} from "./warnings.js";

/**
 * Browser-path step interactions: setTimeout-driven scheduling over the
 * events derived by `deriveActionEvents` (`@scenar/core`) — the canonical
 * offset math the parity suite pins both schedulers to.
 *
 * Play/pause-aware: the step's elapsed time is banked across arm cycles
 * (the `usePlaybackProgress` pattern — a `performance.now()` anchor with
 * the playback rate applied per interval), so a pause suspends every
 * pending event and resume schedules only the remainder at
 * `(offset − elapsed) / rate`. A fired-event ledger (the
 * `useTimeSourceStepInteractions` pattern) guarantees a re-arm — resume,
 * or a mid-step rate change — never double-dispatches an event that
 * already fired. Step entry resets both.
 */
export function useBrowserStepInteractions<T>(
  options: UseStepInteractionsOptions<T>,
  ctx: InteractionContext,
): void {
  const {
    stepIndex,
    narrationManifest,
    steps,
    playbackRate = 1,
    playing = true,
  } = options;

  /** Elapsed time inside the current step, in timeline ms (rate 1). */
  const elapsedMsRef = useRef(0);
  /** Keys of events (and one-shot warnings) already fired this step. */
  const firedRef = useRef<Set<string>>(new Set());

  // Declared BEFORE the scheduling effect: cleanups and effects both run
  // in declaration order, so on a step change the old step's bank and
  // ledger are cleared before the new step's events are armed.
  useEffect(() => {
    elapsedMsRef.current = 0;
    firedRef.current.clear();
  }, [stepIndex]);

  useEffect(() => {
    if (!playing) return;

    const actions = steps[stepIndex]?.interactions;
    if (!actions || actions.length === 0) return;

    const duration = getStepDurationMs(stepIndex, narrationManifest, steps);
    const rate = Math.max(playbackRate, 0.25);

    // This arm's time base: events already inside the banked elapsed are
    // in the ledger (they fired); everything else schedules relative to it.
    const startElapsedMs = elapsedMsRef.current;
    const armedAt = performance.now();

    warnOncePerStep(actions, duration, stepIndex, firedRef.current);

    const timers: ReturnType<typeof setTimeout>[] = [];

    for (const [actionIndex, action] of actions.entries()) {
      for (const event of deriveActionEvents(action, duration)) {
        const key = `a${actionIndex}-${event.kind}${
          event.charIndex != null ? `-${event.charIndex}` : ""
        }`;
        if (firedRef.current.has(key)) continue;

        // An offset at (or marginally behind) the bank means the event's
        // moment has arrived — a timer cleared at the pause boundary, or
        // measurement jitter. Fire it now; the ledger keeps it single.
        const delayMs = Math.max(0, (event.offsetMs - startElapsedMs) / rate);
        timers.push(
          setTimeout(() => {
            firedRef.current.add(key);
            dispatchActionEvent(action, event, ctx);
          }, delayMs),
        );
      }
    }

    return () => {
      for (const t of timers) clearTimeout(t);
      // Bank what this arm consumed: wall time scaled by the rate it ran
      // at, on top of what was already banked. The next arm (resume, rate
      // change) continues from here; a step change zeroes it above.
      elapsedMsRef.current =
        startElapsedMs + (performance.now() - armedAt) * rate;
    };
  }, [stepIndex, narrationManifest, ctx, steps, playbackRate, playing]);
}

/**
 * Authoring warnings for interactions that overflow their step. Emitted
 * once per step entry (ledger-gated) — re-arms from pause/resume or rate
 * changes must not repeat them.
 */
function warnOncePerStep(
  actions: readonly StepAction[],
  duration: number,
  stepIndex: number,
  ledger: Set<string>,
): void {
  if (ledger.has("warned")) return;
  ledger.add("warned");

  for (const action of actions) {
    if (action.type === "type") {
      const text = action.text ?? "";
      if (text.length > 0) {
        warnIfTypingExceedsStep(
          action,
          action.typeDelay ?? TYPE_CHAR_DELAY_MS,
          duration,
          stepIndex,
        );
      }
    } else if (action.type === "hover") {
      warnIfHoverExceedsStep(
        action,
        action.hoverDuration ?? HOVER_HOLD_MS,
        duration,
        stepIndex,
      );
    } else if (action.type === "drag") {
      warnIfDragExceedsStep(action, duration, stepIndex);
    } else if (action.type === "viewport_transition") {
      warnIfViewportTooCloseToAction(action, actions, duration, stepIndex);
    }
  }
}
