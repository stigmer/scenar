import type { StepAction } from "@scenar/core";
import type { InteractionContext } from "../context.js";
import { findCursorTarget } from "../dom-helpers.js";

/** Dispatch a native click on a cursor-target element. */
export function dispatchClick(action: StepAction, ctx: InteractionContext): void {
  const el = findCursorTarget(action.target, ctx.containerRef.current);
  if (el) el.click();
}
