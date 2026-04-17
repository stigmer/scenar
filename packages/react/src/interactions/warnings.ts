import { CLICK_DELAY_MS, DRAG_SETTLE_MS, VIEWPORT_SETTLE_MS } from "@scenar/core";
import type { StepAction } from "@scenar/core";

export function warnIfTypingExceedsStep(
  action: StepAction,
  charDelay: number,
  stepDurationMs: number,
  stepIdx: number,
): void {
  if (process.env.NODE_ENV !== "development") return;
  const text = action.text ?? "";
  const typingDuration = action.atPercent * stepDurationMs + CLICK_DELAY_MS + text.length * charDelay;
  if (typingDuration > stepDurationMs) {
    console.warn(
      `[scenar] type action in step ${stepIdx} at ${action.atPercent} ` +
        `needs ~${Math.round(typingDuration)}ms but step is only ${Math.round(stepDurationMs)}ms.`,
    );
  }
}

export function warnIfHoverExceedsStep(
  action: StepAction,
  hoverDuration: number,
  stepDurationMs: number,
  stepIdx: number,
): void {
  if (process.env.NODE_ENV !== "development") return;
  const totalMs = action.atPercent * stepDurationMs + CLICK_DELAY_MS + hoverDuration;
  if (totalMs > stepDurationMs) {
    console.warn(
      `[scenar] hover action in step ${stepIdx} at ${action.atPercent} ` +
        `needs ~${Math.round(totalMs)}ms but step is only ${Math.round(stepDurationMs)}ms.`,
    );
  }
}

export function warnIfDragExceedsStep(
  action: StepAction,
  stepDurationMs: number,
  stepIdx: number,
): void {
  if (process.env.NODE_ENV !== "development") return;
  const totalMs = action.atPercent * stepDurationMs + CLICK_DELAY_MS + DRAG_SETTLE_MS + CLICK_DELAY_MS;
  if (totalMs > stepDurationMs) {
    console.warn(
      `[scenar] drag action in step ${stepIdx} at ${action.atPercent} ` +
        `needs ~${Math.round(totalMs)}ms but step is only ${Math.round(stepDurationMs)}ms.`,
    );
  }
}

export function warnIfViewportTooCloseToAction(
  vpAction: StepAction,
  allActions: readonly StepAction[],
  stepDurationMs: number,
  stepIdx: number,
): void {
  if (process.env.NODE_ENV !== "development") return;
  const vpFireAt = vpAction.atPercent * stepDurationMs;
  const settleAt = vpFireAt + VIEWPORT_SETTLE_MS;

  for (const other of allActions) {
    if (other === vpAction) continue;
    if (other.type === "viewport_transition" || other.type === "clear_cursor") continue;
    const otherFireAt = other.atPercent * stepDurationMs;
    if (otherFireAt > vpFireAt && otherFireAt < settleAt) {
      console.warn(
        `[scenar] ${other.type} action in step ${stepIdx} at ${other.atPercent} ` +
          `fires ${Math.round(otherFireAt - vpFireAt)}ms after a viewport-transition.`,
      );
    }
  }
}
