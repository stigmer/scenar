import { cursorTargetSelector, scrollTargetSelector } from "@scenar/core";

/**
 * Find a cursor-target element inside the container. Returns null
 * with a dev-mode warning if not found.
 */
export function findCursorTarget(
  target: string | undefined,
  container: HTMLElement | null,
): HTMLElement | null {
  if (!target || !container) return null;
  const el = container.querySelector(cursorTargetSelector(target));
  if (!el || !(el instanceof HTMLElement)) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[scenar] cursor target "${target}" not found in DOM. ` +
          `Ensure a [data-cursor-target="${target}"] element exists.`,
      );
    }
    return null;
  }
  return el;
}

/**
 * Find a scroll-target element inside the container. Returns null
 * with a dev-mode warning if not found.
 */
export function findScrollTarget(
  target: string | undefined,
  container: HTMLElement | null,
): Element | null {
  if (!target || !container) return null;
  const el = container.querySelector(scrollTargetSelector(target));
  if (!el) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[scenar] scroll target "${target}" not found in DOM. ` +
          `Ensure a [data-scroll-target="${target}"] element exists.`,
      );
    }
    return null;
  }
  return el;
}

/**
 * Resolve a cursor-target element to the underlying input or textarea.
 */
export function resolveInput(
  target: string,
  container: HTMLElement | null,
): HTMLInputElement | HTMLTextAreaElement | null {
  if (!container) return null;
  const targetEl = container.querySelector(cursorTargetSelector(target));
  if (!targetEl) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[scenar] type target "${target}" not found in DOM.`);
    }
    return null;
  }
  if (targetEl instanceof HTMLInputElement || targetEl instanceof HTMLTextAreaElement) {
    return targetEl;
  }
  const input = targetEl.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
  if (!input && process.env.NODE_ENV === "development") {
    console.warn(
      `[scenar] type target "${target}" has no <input> or <textarea> descendant.`,
    );
  }
  return input;
}
