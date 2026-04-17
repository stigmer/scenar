import { useEffect, useRef } from "react";
import {
  CLICK_DELAY_MS,
  DRAG_SETTLE_MS,
  HOVER_HOLD_MS,
  TYPE_CHAR_DELAY_MS,
  type StepAction,
  getStepDurationMs,
} from "@scenar/core";
import type { UseStepInteractionsOptions } from "@scenar/core";
import type { TimeSourceValue } from "../time/TimeSource.js";
import type { InteractionContext } from "./context.js";
import { dispatchClick } from "./effects/click.js";
import { typeTextIntoTarget } from "./effects/type.js";
import { dispatchHoverEnter, dispatchHoverLeave } from "./effects/hover.js";
import { dispatchDragPress, dispatchDragRelease } from "./effects/drag.js";
import { applyViewportTransition } from "./effects/viewport-transition.js";
import { executeScrollTo } from "./effects/scroll-to.js";
import { executeSetCursor } from "./effects/set-cursor.js";
import { executeClearCursor } from "./effects/clear-cursor.js";

/**
 * Video-export-path step interactions: synchronous, frame-driven.
 * Runs every render when a TimeSource is present.
 */
export function useTimeSourceStepInteractions<T>(
  options: UseStepInteractionsOptions<T>,
  ctx: InteractionContext,
  timeSource: TimeSourceValue,
): void {
  const { stepIndex, narrationManifest, steps } = options;
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const actions = steps[stepIndex]?.interactions;
    if (!actions || actions.length === 0) return;

    const stepStartMs = timeSource.stepStartTimesMs[stepIndex] ?? 0;
    const nextStepStartMs = timeSource.stepStartTimesMs[stepIndex + 1];
    const stepDuration = nextStepStartMs != null
      ? nextStepStartMs - stepStartMs
      : getStepDurationMs(stepIndex, narrationManifest, steps);

    const elapsed = timeSource.currentTimeMs - stepStartMs;

    for (const action of actions) {
      const fireAt = action.atPercent * stepDuration;

      if (action.type === "click") {
        fire(`${stepIndex}-${action.atPercent}-click-cursor`, elapsed, fireAt, () => {
          ctx.setCursorTarget(action.target);
        });
        fire(`${stepIndex}-${action.atPercent}-click-dispatch`, elapsed, fireAt + CLICK_DELAY_MS, () => {
          dispatchClick(action, ctx);
        });
      } else if (action.type === "type") {
        const text = action.text ?? "";
        if (text.length === 0) continue;
        const charDelay = action.typeDelay ?? TYPE_CHAR_DELAY_MS;
        fire(`${stepIndex}-${action.atPercent}-type-cursor`, elapsed, fireAt, () => {
          ctx.setCursorTarget(action.target);
        });
        const typingStart = fireAt + CLICK_DELAY_MS;
        if (elapsed >= typingStart) {
          const charCount = Math.min(Math.floor((elapsed - typingStart) / charDelay) + 1, text.length);
          fire(`${stepIndex}-${action.atPercent}-type-char-${charCount}`, elapsed, 0, () => {
            typeTextIntoTarget(action, text.substring(0, charCount), ctx);
          });
        }
      } else if (action.type === "hover") {
        const holdMs = action.hoverDuration ?? HOVER_HOLD_MS;
        fire(`${stepIndex}-${action.atPercent}-hover-cursor`, elapsed, fireAt, () => {
          ctx.setShowRipple?.(false);
          ctx.setCursorTarget(action.target);
        });
        fire(`${stepIndex}-${action.atPercent}-hover-enter`, elapsed, fireAt + CLICK_DELAY_MS, () => {
          dispatchHoverEnter(action, ctx);
        });
        fire(`${stepIndex}-${action.atPercent}-hover-leave`, elapsed, fireAt + CLICK_DELAY_MS + holdMs, () => {
          dispatchHoverLeave(action, ctx);
          ctx.setShowRipple?.(true);
        });
      } else if (action.type === "drag") {
        fire(`${stepIndex}-${action.atPercent}-drag-cursor`, elapsed, fireAt, () => {
          ctx.setShowRipple?.(false);
          ctx.setCursorTarget(action.target);
        });
        fire(`${stepIndex}-${action.atPercent}-drag-press`, elapsed, fireAt + CLICK_DELAY_MS, () => {
          ctx.setDragging?.(true);
          dispatchDragPress(action, ctx);
        });
        fire(`${stepIndex}-${action.atPercent}-drag-move`, elapsed, fireAt + CLICK_DELAY_MS + DRAG_SETTLE_MS, () => {
          ctx.setCursorTarget(action.dragTarget);
        });
        fire(`${stepIndex}-${action.atPercent}-drag-release`, elapsed, fireAt + CLICK_DELAY_MS + DRAG_SETTLE_MS + CLICK_DELAY_MS, () => {
          dispatchDragRelease(action, ctx);
          ctx.setDragging?.(false);
          ctx.setShowRipple?.(true);
        });
      } else if (action.type === "viewport_transition") {
        fire(`${stepIndex}-${action.atPercent}-viewport`, elapsed, fireAt, () => {
          applyViewportTransition(action, ctx);
        });
      } else {
        fire(`${stepIndex}-${action.atPercent}-${action.type}`, elapsed, fireAt, () => {
          executeSimpleAction(action, ctx);
        });
      }
    }
  });

  useEffect(() => {
    firedRef.current.clear();
  }, [stepIndex]);

  function fire(key: string, elapsed: number, threshold: number, fn: () => void): void {
    if (elapsed >= threshold && !firedRef.current.has(key)) {
      firedRef.current.add(key);
      fn();
    }
  }
}

function executeSimpleAction(action: StepAction, ctx: InteractionContext): void {
  switch (action.type) {
    case "scroll_to":
      executeScrollTo(action, ctx);
      break;
    case "set_cursor":
      executeSetCursor(action, ctx);
      break;
    case "clear_cursor":
      executeClearCursor(action, ctx);
      break;
    default:
      ctx.setCursorTarget(action.target);
      break;
  }
}
