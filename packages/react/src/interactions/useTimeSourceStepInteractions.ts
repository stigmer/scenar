import { useEffect, useRef } from "react";
import {
  TYPE_CHAR_DELAY_MS,
  deriveActionEvents,
  getStepDurationMs,
} from "@scenar/core";
import type { UseStepInteractionsOptions } from "@scenar/core";
import type { TimeSourceValue } from "../time/TimeSource.js";
import type { InteractionContext } from "./context.js";
import { dispatchActionEvent } from "./dispatch-action-event.js";

/**
 * Video-export-path step interactions: synchronous, frame-driven. Runs
 * every render when a TimeSource is present, firing each event derived
 * by `deriveActionEvents` (`@scenar/core`) once frame time crosses its
 * offset — the same derivation and effect dispatch
 * (`dispatchActionEvent`) the browser scheduler runs on timers, pinned
 * together by the parity suite.
 */
export function useTimeSourceStepInteractions<T>(
  options: UseStepInteractionsOptions<T>,
  ctx: InteractionContext,
  timeSource: TimeSourceValue,
): void {
  const { stepIndex, narrationManifest, steps } = options;
  const firedRef = useRef<Set<string>>(new Set());

  // Declared BEFORE the firing effect: effects run in declaration order,
  // so on mount (and step change) the reset happens first and the keys the
  // firing effect records survive the commit. With the order reversed, the
  // mount commit would clear the keys recorded moments earlier and any
  // event already past its threshold (an atPercent-0 action at frame 0)
  // would dispatch a second time on the next render.
  useEffect(() => {
    firedRef.current.clear();
  }, [stepIndex]);

  useEffect(() => {
    const actions = steps[stepIndex]?.interactions;
    if (!actions || actions.length === 0) return;

    const stepStartMs = timeSource.stepStartTimesMs[stepIndex] ?? 0;
    const nextStepStartMs = timeSource.stepStartTimesMs[stepIndex + 1];
    const stepDuration = nextStepStartMs != null
      ? nextStepStartMs - stepStartMs
      : getStepDurationMs(stepIndex, narrationManifest, steps);

    const elapsed = timeSource.currentTimeMs - stepStartMs;

    for (const [actionIndex, action] of actions.entries()) {
      const events = deriveActionEvents(action, stepDuration);

      for (const event of events) {
        // Keystrokes are coalesced below: a frame jump lands on the final
        // text directly instead of replaying every character in one frame.
        if (event.kind === "keystroke") continue;
        fire(`a${actionIndex}-${event.kind}`, elapsed, event.offsetMs, () =>
          dispatchActionEvent(action, event, ctx),
        );
      }

      // Keystroke coalescing (frame-path-specific): dispatch only the
      // latest crossed keystroke — its substring subsumes the earlier
      // ones, so the rendered text is identical with one DOM write. The
      // first derived keystroke's offset is the typing start.
      const firstKeystroke = events.find((e) => e.kind === "keystroke");
      if (firstKeystroke && elapsed >= firstKeystroke.offsetMs) {
        const text = action.text ?? "";
        const charDelay = action.typeDelay ?? TYPE_CHAR_DELAY_MS;
        const charIndex = Math.min(
          Math.floor((elapsed - firstKeystroke.offsetMs) / charDelay),
          text.length - 1,
        );
        fire(`a${actionIndex}-keystroke-${charIndex}`, elapsed, 0, () =>
          dispatchActionEvent(
            action,
            {
              kind: "keystroke",
              offsetMs: firstKeystroke.offsetMs + charIndex * charDelay,
              charIndex,
            },
            ctx,
          ),
        );
      }
    }
  });

  function fire(key: string, elapsed: number, threshold: number, fn: () => void): void {
    if (elapsed >= threshold && !firedRef.current.has(key)) {
      firedRef.current.add(key);
      fn();
    }
  }
}
