import type { ViewportTransform } from "@scenar/core";

/**
 * Shared context passed to every interaction effect function.
 * Provides DOM access and callback handles without coupling effects
 * to React hooks.
 */
export interface InteractionContext {
  containerRef: { current: HTMLElement | null };
  /**
   * The camera's content element (`ViewportTransformLayer`'s `contentRef`).
   * `viewport_transition` target math measures against it so canonical
   * coordinates stay correct at any camera state — measuring against the
   * un-transformed container is only valid while the camera is at identity.
   * Optional: effects fall back to `containerRef` when absent.
   */
  cameraRef?: { current: HTMLElement | null };
  setCursorTarget: (target: string | undefined) => void;
  setShowRipple?: (show: boolean) => void;
  setDragging?: (dragging: boolean) => void;
  setViewportTransform?: (transform: ViewportTransform) => void;
  isVideoExport: boolean;
}
