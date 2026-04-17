import type { StepAction } from "@scenar/core";
import type { InteractionContext } from "../context.js";
import { findCursorTarget } from "../dom-helpers.js";

/** Dispatch pointerdown on the drag source and mark it as dragging. */
export function dispatchDragPress(action: StepAction, ctx: InteractionContext): void {
  const el = findCursorTarget(action.target, ctx.containerRef.current);
  if (!el) return;
  el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  el.setAttribute("data-dragging", "true");
}

/** Dispatch pointerup on the drag destination and clean up the source. */
export function dispatchDragRelease(action: StepAction, ctx: InteractionContext): void {
  const destEl = findCursorTarget(action.dragTarget, ctx.containerRef.current);
  if (destEl) {
    destEl.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
  }
  const srcEl = findCursorTarget(action.target, ctx.containerRef.current);
  if (srcEl) {
    srcEl.removeAttribute("data-dragging");
  }
}
