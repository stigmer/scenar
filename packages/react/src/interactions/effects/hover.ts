import type { StepAction } from "@scenar/core";
import type { InteractionContext } from "../context.js";
import { findCursorTarget } from "../dom-helpers.js";

/** Dispatch pointer/mouse enter events and set data-hover attribute. */
export function dispatchHoverEnter(action: StepAction, ctx: InteractionContext): void {
  const el = findCursorTarget(action.target, ctx.containerRef.current);
  if (!el) return;
  el.dispatchEvent(new PointerEvent("pointerenter", { bubbles: false }));
  el.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
  el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  el.setAttribute("data-hover", "true");
}

/** Dispatch pointer/mouse leave events and remove data-hover attribute. */
export function dispatchHoverLeave(action: StepAction, ctx: InteractionContext): void {
  const el = findCursorTarget(action.target, ctx.containerRef.current);
  if (!el) return;
  el.dispatchEvent(new PointerEvent("pointerleave", { bubbles: false }));
  el.dispatchEvent(new PointerEvent("pointerout", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("mouseleave", { bubbles: false }));
  el.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
  el.removeAttribute("data-hover");
}
