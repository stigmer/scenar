import type { ViewportTransform } from "@scenar/core";

/**
 * Shared context passed to every interaction effect function.
 * Provides DOM access and callback handles without coupling effects
 * to React hooks.
 */
export interface InteractionContext {
  containerRef: { current: HTMLElement | null };
  setCursorTarget: (target: string | undefined) => void;
  setShowRipple?: (show: boolean) => void;
  setDragging?: (dragging: boolean) => void;
  setViewportTransform?: (transform: ViewportTransform) => void;
  isVideoExport: boolean;
}
