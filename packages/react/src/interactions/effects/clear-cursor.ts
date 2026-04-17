import type { StepAction } from "@scenar/core";
import type { InteractionContext } from "../context.js";

export function executeClearCursor(_action: StepAction, ctx: InteractionContext): void {
  ctx.setCursorTarget(undefined);
}
