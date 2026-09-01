import type { StepAction } from "@scenar/core";
import type { InteractionContext } from "../context.js";
import { findCursorTarget } from "../dom-helpers.js";
import { runEngineClick } from "../engine-click-guard.js";

/**
 * Dispatch a native click on a cursor-target element. Marked as
 * engine-initiated so it bubbles through the integrator's handlers as a
 * real click while `ScenarioPlayer`'s click-to-toggle ignores it — the
 * choreography must never pause its own playback.
 */
export function dispatchClick(action: StepAction, ctx: InteractionContext): void {
  const el = findCursorTarget(action.target, ctx.containerRef.current);
  if (el) runEngineClick(() => el.click());
}
