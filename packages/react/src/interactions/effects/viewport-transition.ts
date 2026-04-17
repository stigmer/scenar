import { type StepAction, type ViewportTransform, cursorTargetSelector } from "@scenar/core";
import type { InteractionContext } from "../context.js";

const DEFAULT_VIEWPORT_ZOOM = 1.5;

function computeViewportTransformForTarget(
  target: string,
  scale: number,
  container: HTMLElement,
): ViewportTransform | null {
  const el = container.querySelector(cursorTargetSelector(target));
  if (!el) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[scenar] viewport_transition target "${target}" not found in DOM.`,
      );
    }
    return null;
  }

  const cRect = container.getBoundingClientRect();
  const eRect = el.getBoundingClientRect();
  const zoom = cRect.width / container.offsetWidth || 1;

  const ex = (eRect.left - cRect.left + eRect.width / 2) / zoom;
  const ey = (eRect.top - cRect.top + eRect.height / 2) / zoom;

  return {
    scale,
    x: container.offsetWidth / 2 - ex * scale,
    y: container.offsetHeight / 2 - ey * scale,
  };
}

/** Apply a viewport zoom/pan transition or reset to identity. */
export function applyViewportTransition(action: StepAction, ctx: InteractionContext): void {
  if (!ctx.setViewportTransform) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[scenar] viewport_transition action found but no setViewportTransform callback.",
      );
    }
    return;
  }

  if (action.viewportReset) {
    ctx.setViewportTransform({ scale: 1, x: 0, y: 0 });
    return;
  }

  if (!action.target) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[scenar] viewport_transition has no target and viewportReset is not set.",
      );
    }
    return;
  }

  const container = ctx.containerRef.current;
  if (!container) return;

  const scale = action.viewportZoom ?? DEFAULT_VIEWPORT_ZOOM;
  const transform = computeViewportTransformForTarget(action.target, scale, container);
  if (transform) ctx.setViewportTransform(transform);
}
