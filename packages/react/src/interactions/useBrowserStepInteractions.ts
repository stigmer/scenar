import { useEffect } from "react";
import {
  CLICK_DELAY_MS,
  DRAG_SETTLE_MS,
  HOVER_HOLD_MS,
  TYPE_CHAR_DELAY_MS,
  type StepAction,
  getStepDurationMs,
} from "@scenar/core";
import type { UseStepInteractionsOptions } from "@scenar/core";
import type { InteractionContext } from "./context.js";
import { executeScrollTo } from "./effects/scroll-to.js";
import { executeSetCursor } from "./effects/set-cursor.js";
import { executeClearCursor } from "./effects/clear-cursor.js";
import { dispatchClick } from "./effects/click.js";
import { typeTextIntoTarget } from "./effects/type.js";
import { dispatchHoverEnter, dispatchHoverLeave } from "./effects/hover.js";
import { dispatchDragPress, dispatchDragRelease } from "./effects/drag.js";
import { applyViewportTransition } from "./effects/viewport-transition.js";
import {
  warnIfDragExceedsStep,
  warnIfHoverExceedsStep,
  warnIfTypingExceedsStep,
  warnIfViewportTooCloseToAction,
} from "./warnings.js";

/**
 * Browser-path step interactions: setTimeout-driven scheduling.
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
  } = options;

  useEffect(() => {
    const actions = steps[stepIndex]?.interactions;
    if (!actions || actions.length === 0) return;

    const duration = getStepDurationMs(stepIndex, narrationManifest, steps);
    const rate = Math.max(playbackRate, 0.25);
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (const action of actions) {
      const fireAt = (action.atPercent * duration) / rate;

      if (action.type === "click") {
        timers.push(setTimeout(() => ctx.setCursorTarget(action.target), fireAt));
        timers.push(
          setTimeout(() => dispatchClick(action, ctx), fireAt + CLICK_DELAY_MS / rate),
        );
      } else if (action.type === "type") {
        const text = action.text ?? "";
        if (text.length === 0) continue;
        const charDelay = action.typeDelay ?? TYPE_CHAR_DELAY_MS;
        warnIfTypingExceedsStep(action, charDelay, duration, stepIndex);
        timers.push(setTimeout(() => ctx.setCursorTarget(action.target), fireAt));
        const typingStart = fireAt + CLICK_DELAY_MS / rate;
        for (let i = 0; i < text.length; i++) {
          const chars = text.substring(0, i + 1);
          timers.push(
            setTimeout(() => typeTextIntoTarget(action, chars, ctx), typingStart + (i * charDelay) / rate),
          );
        }
      } else if (action.type === "hover") {
        const holdMs = action.hoverDuration ?? HOVER_HOLD_MS;
        warnIfHoverExceedsStep(action, holdMs, duration, stepIndex);
        timers.push(
          setTimeout(() => {
            ctx.setShowRipple?.(false);
            ctx.setCursorTarget(action.target);
          }, fireAt),
        );
        timers.push(
          setTimeout(() => dispatchHoverEnter(action, ctx), fireAt + CLICK_DELAY_MS / rate),
        );
        timers.push(
          setTimeout(() => {
            dispatchHoverLeave(action, ctx);
            ctx.setShowRipple?.(true);
          }, fireAt + (CLICK_DELAY_MS + holdMs) / rate),
        );
      } else if (action.type === "drag") {
        warnIfDragExceedsStep(action, duration, stepIndex);
        timers.push(
          setTimeout(() => {
            ctx.setShowRipple?.(false);
            ctx.setCursorTarget(action.target);
          }, fireAt),
        );
        timers.push(
          setTimeout(() => {
            ctx.setDragging?.(true);
            dispatchDragPress(action, ctx);
          }, fireAt + CLICK_DELAY_MS / rate),
        );
        timers.push(
          setTimeout(
            () => ctx.setCursorTarget(action.dragTarget),
            fireAt + (CLICK_DELAY_MS + DRAG_SETTLE_MS) / rate,
          ),
        );
        timers.push(
          setTimeout(() => {
            dispatchDragRelease(action, ctx);
            ctx.setDragging?.(false);
            ctx.setShowRipple?.(true);
          }, fireAt + (CLICK_DELAY_MS + DRAG_SETTLE_MS + CLICK_DELAY_MS) / rate),
        );
      } else if (action.type === "viewport_transition") {
        warnIfViewportTooCloseToAction(action, actions, duration, stepIndex);
        timers.push(setTimeout(() => applyViewportTransition(action, ctx), fireAt));
      } else {
        timers.push(
          setTimeout(() => executeSimpleAction(action, ctx), fireAt),
        );
      }
    }

    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [stepIndex, narrationManifest, ctx, steps, playbackRate]);
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
