import type { StepAction } from "@scenar/core";
import type { InteractionContext } from "../context.js";
import { resolveInput } from "../dom-helpers.js";

/**
 * Set an input's value using the native property setter, then dispatch
 * a bubbling `input` event so React's synthetic onChange fires.
 */
export function typeTextIntoTarget(action: StepAction, text: string, ctx: InteractionContext): void {
  if (!action.target) return;
  const input = resolveInput(action.target, ctx.containerRef.current);
  if (!input) return;

  const proto =
    input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(input, text);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
