import { type StepAction, type ViewportTransform, cursorTargetSelector } from "@scenar/core";
import type { InteractionContext } from "../context.js";

const DEFAULT_VIEWPORT_ZOOM = 1.5;

/**
 * Compute the transform that centers `target` at `scale`, measuring against
 * `reference` — the camera's content element when available. Because the
 * reference carries every accumulated scale (DemoViewport's CSS zoom *and*
 * the current camera transform), the rect-over-offset ratio converts screen
 * rects back to canonical coordinates at any camera state, so a second
 * camera move computed while the camera is already zoomed still lands
 * correctly. Measuring against the un-transformed container is only exact
 * at camera identity.
 */
function computeViewportTransformForTarget(
  target: string,
  scale: number,
  reference: HTMLElement,
): ViewportTransform | null {
  const el = reference.querySelector(cursorTargetSelector(target));
  if (!el) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[scenar] viewport_transition target "${target}" not found in DOM.`,
      );
    }
    return null;
  }

  const cRect = reference.getBoundingClientRect();
  const eRect = el.getBoundingClientRect();
  const zoom = cRect.width / reference.offsetWidth || 1;

  const ex = (eRect.left - cRect.left + eRect.width / 2) / zoom;
  const ey = (eRect.top - cRect.top + eRect.height / 2) / zoom;

  return {
    scale,
    x: reference.offsetWidth / 2 - ex * scale,
    y: reference.offsetHeight / 2 - ey * scale,
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

  const reference = ctx.cameraRef?.current ?? ctx.containerRef.current;
  if (!reference) return;

  const scale = action.viewportZoom ?? DEFAULT_VIEWPORT_ZOOM;
  const transform = computeViewportTransformForTarget(action.target, scale, reference);
  if (transform) ctx.setViewportTransform(transform);
}
