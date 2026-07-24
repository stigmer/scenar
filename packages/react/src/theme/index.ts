/**
 * CSS class that activates the `--scenar-*` token scope.
 *
 * Wrap your scenario container with this class so that shell components
 * resolve their CSS custom properties. In dark mode, add both:
 *
 *     <div className={`${SCENAR_CLASS} dark`}>…</div>
 */
export const SCENAR_CLASS = "scenar" as const;

/** The two color modes a packed embed can render in. */
export type ColorMode = "light" | "dark";

/**
 * Resolve a packed embed's color mode from its own URL (`?theme=dark`).
 *
 * An embed opts into dark by being framed at `…/?theme=dark`; the packed embed
 * entry adds the `dark` class alongside {@link SCENAR_CLASS} to activate the
 * `.scenar.dark` tokens. Use this inside a tour's `.scenar/providers.tsx` to
 * pass the matching `colorMode` to your product's provider, so real components
 * track the embed's theme. Defaults to `"light"` — SSR-safe, and on any parse
 * error — matching the embed entry's own default.
 */
export function getEmbedColorMode(): ColorMode {
  if (typeof window === "undefined") return "light";
  try {
    return new URLSearchParams(window.location.search).get("theme") === "dark"
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}
