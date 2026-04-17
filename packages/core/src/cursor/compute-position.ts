/** A 2D point in CSS coordinate space. */
export interface Position {
  x: number;
  y: number;
}

/**
 * Compute cursor position relative to the container, accounting for
 * CSS zoom on ancestors. `getBoundingClientRect` returns viewport
 * coordinates (post-zoom), but `position: absolute` inside a
 * CSS-zoomed container uses pre-zoom coordinates. Dividing by the
 * effective zoom converts viewport offsets back to CSS space.
 */
export function computeCursorPosition(container: HTMLElement, el: Element): Position {
  const cRect = container.getBoundingClientRect();
  const eRect = el.getBoundingClientRect();
  const zoom = cRect.width / container.offsetWidth || 1;

  return {
    x: (eRect.left - cRect.left + eRect.width / 2) / zoom,
    y: (eRect.top - cRect.top + eRect.height / 2) / zoom,
  };
}
