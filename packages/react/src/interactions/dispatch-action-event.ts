import type { ActionEvent, StepAction } from "@scenar/core";
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
 * Execute one derived {@link ActionEvent} against the interaction
 * effects — the single statement of "which effect an event fires",
 * shared by both schedulers (`useBrowserStepInteractions` schedules
 * events on timers; `useTimeSourceStepInteractions` fires them as
 * frame time crosses their offsets). `deriveActionEvents` in
 * `@scenar/core` owns WHEN an event fires; this module owns WHAT it
 * does. A new event kind is wired here once and both time domains
 * pick it up.
 */
export function dispatchActionEvent(
  action: StepAction,
  event: ActionEvent,
  ctx: InteractionContext,
): void {
  switch (event.kind) {
    case "cursor-move":
      // Hover and drag hide the click ripple for the duration of the
      // gesture (their leave/release events restore it); a plain move
      // to a click/type target keeps it.
      if (action.type === "hover" || action.type === "drag") {
        ctx.setShowRipple?.(false);
      }
      ctx.setCursorTarget(action.target);
      break;

    case "click-dispatch":
      dispatchClick(action, ctx);
      break;

    case "keystroke":
      typeTextIntoTarget(
        action,
        (action.text ?? "").substring(0, (event.charIndex ?? 0) + 1),
        ctx,
      );
      break;

    case "hover-enter":
      dispatchHoverEnter(action, ctx);
      break;

    case "hover-leave":
      dispatchHoverLeave(action, ctx);
      ctx.setShowRipple?.(true);
      break;

    case "drag-press":
      ctx.setDragging?.(true);
      dispatchDragPress(action, ctx);
      break;

    case "drag-move":
      ctx.setCursorTarget(action.dragTarget);
      break;

    case "drag-release":
      dispatchDragRelease(action, ctx);
      ctx.setDragging?.(false);
      ctx.setShowRipple?.(true);
      break;

    case "viewport-transition":
      applyViewportTransition(action, ctx);
      break;

    case "simple-dispatch":
      executeSimpleAction(action, ctx);
      break;
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
