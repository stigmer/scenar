import { scrollTargetIntoView, scrollTargetIntoViewInstant } from "@scenar/core";
import type { StepAction } from "@scenar/core";
import type { InteractionContext } from "../context.js";
import { findScrollTarget } from "../dom-helpers.js";

export function executeScrollTo(action: StepAction, ctx: InteractionContext): void {
  const el = findScrollTarget(action.target, ctx.containerRef.current);
  if (!el) return;
  if (ctx.isVideoExport) {
    scrollTargetIntoViewInstant(el);
  } else {
    scrollTargetIntoView(el);
  }
}
