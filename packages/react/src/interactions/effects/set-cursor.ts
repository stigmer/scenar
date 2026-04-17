import type { StepAction } from "@scenar/core";
import type { InteractionContext } from "../context.js";

export function executeSetCursor(action: StepAction, ctx: InteractionContext): void {
  if (process.env.NODE_ENV === "development" && action.target) {
    const container = ctx.containerRef.current;
    if (container) {
      const el = container.querySelector(`[data-cursor-target="${action.target}"]`);
      if (!el) {
        console.warn(
          `[scenar] set_cursor target "${action.target}" not found in DOM.`,
        );
      }
    }
  }
  ctx.setCursorTarget(action.target);
}
