import { createContext, useContext } from "react";

/**
 * Portal target for zoom-invariant player chrome.
 *
 * `DemoViewport` scales scenario content with CSS `zoom` (and a camera move
 * scales it further inside `ViewportTransformLayer`), which is exactly right
 * for the recording and exactly wrong for the player's transport controls: a
 * bar authored at 36px buttons rendered at `zoom: 0.7` becomes a 25px bar,
 * and it drifts with every camera move. Real video players render chrome at
 * native pixel size regardless of how the footage scales.
 *
 * The contract: `DemoViewport` provides an unscaled overlay element that
 * covers the *visual* content box (a sibling of the zoomed canonical div,
 * `absolute inset-0` in the wrapper). `ScenarioPlayer` portals its controls
 * into that element when one is provided, and renders them inline — the
 * pre-chrome-layer behavior — when it is `null` (standalone players, the
 * video-export passthrough, the capture mount).
 *
 * The target carries `pointer-events: none` so it never eats clicks meant
 * for the content; the control bar re-enables its own pointer events. React
 * portals bubble events through the React tree, so the player's
 * click-to-toggle and mousemove-to-reveal handlers keep working unchanged.
 */
const ViewportChromeContext = createContext<HTMLElement | null>(null);

export const ViewportChromeProvider = ViewportChromeContext.Provider;

/** The chrome overlay element, or `null` when no viewport provides one. */
export function useViewportChromeTarget(): HTMLElement | null {
  return useContext(ViewportChromeContext);
}
