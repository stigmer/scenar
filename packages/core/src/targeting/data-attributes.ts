/**
 * Centralized data-attribute contract for the scenario engine.
 *
 * The engine identifies interactive elements in the DOM via these
 * data attributes. This module is the single source of truth for
 * attribute names and selector builders — consumers never hard-code
 * attribute strings.
 */

/** Attribute name for cursor-targetable elements. */
export const CURSOR_TARGET_ATTRIBUTE = "data-cursor-target";

/** Attribute name for scroll-targetable elements. */
export const SCROLL_TARGET_ATTRIBUTE = "data-scroll-target";

/** Attribute set on elements during hover interactions. */
export const HOVER_STATE_ATTRIBUTE = "data-hover";

/** Attribute set on elements during drag interactions. */
export const DRAG_STATE_ATTRIBUTE = "data-dragging";

/** Build a CSS selector for a cursor target by its ID. */
export function cursorTargetSelector(id: string): string {
  return `[${CURSOR_TARGET_ATTRIBUTE}="${id}"]`;
}

/** Build a CSS selector for a scroll target by its ID. */
export function scrollTargetSelector(id: string): string {
  return `[${SCROLL_TARGET_ATTRIBUTE}="${id}"]`;
}
