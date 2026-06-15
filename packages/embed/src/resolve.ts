/**
 * Pure, DOM-free helpers shared by every adapter (the `<scenar-embed>` element,
 * the React wrapper, and the IIFE global). Keeping URL/theme/origin resolution
 * here — with zero DOM access — makes each rule unit-testable in isolation and
 * guarantees the element and the React component resolve identically.
 */

/**
 * How the embed's color theme is chosen.
 *
 * - `auto` (default) — track the host page's `dark` class on `<html>`.
 * - `light` / `dark` — pin the theme regardless of the host.
 */
export type ScenarEmbedTheme = "auto" | "light" | "dark";

/**
 * The tour's recorded canonical viewport (mirrors `DEFAULT_VIEWPORT` in
 * `@scenar/cli`). Used as the pre-handshake aspect-ratio baseline, before the
 * embed reports its exact rendered size over the `resize` event.
 */
export const EMBED_BASE_ASPECT_WIDTH = 896;
export const EMBED_BASE_ASPECT_HEIGHT = 480;

/**
 * Where a tour is served from. Pass `src` (the full embed URL) directly, or a
 * `base` + `id` pair that resolves to `<base>/<id>/` — the convenience the React
 * wrapper offers so docs can reference tours by slug.
 */
export interface EmbedSource {
  /** The full embed URL (absolute). Takes precedence over `id` + `base`. */
  readonly src?: string;
  /** The published tour slug, resolved against `base`. */
  readonly id?: string;
  /** The base URL the `id` is resolved under (e.g. a GitHub Pages repo root). */
  readonly base?: string;
}

/**
 * Resolve an {@link EmbedSource} to a single absolute embed URL (without the
 * theme query — that is layered on at mount time). Throws a developer-actionable
 * error if neither form is supplied.
 */
export function resolveEmbedSrc(source: EmbedSource): string {
  if (source.src) return source.src;
  if (source.id && source.base) {
    const base = source.base.endsWith("/") ? source.base : `${source.base}/`;
    return `${base}${source.id}/`;
  }
  throw new Error("ScenarEmbed: provide `src`, or both `id` and `base`.");
}

/**
 * Collapse a {@link ScenarEmbedTheme} to the concrete `light`/`dark` the embed
 * understands. `auto` defers to `isDark` (the host's resolved state), which the
 * caller reads from the DOM — this function stays pure.
 */
export function resolveTheme(theme: ScenarEmbedTheme, isDark: boolean): "light" | "dark" {
  if (theme === "light") return "light";
  if (theme === "dark") return "dark";
  return isDark ? "dark" : "light";
}

/**
 * Stamp the resolved theme onto an embed URL as `?theme=…`. The packed embed
 * reads this query at load to apply its palette; changing it reloads the frame
 * in the new theme (acceptable for an autoplay demo).
 */
export function applyThemeToSrc(src: string, theme: "light" | "dark"): string {
  const url = new URL(src);
  url.searchParams.set("theme", theme);
  return url.toString();
}

/**
 * The embed's exact origin (scheme + host + port, no path) — used to pin both
 * inbound events and outbound commands. Derived from the embed URL.
 */
export function originFromSrc(src: string): string {
  return new URL(src).origin;
}
