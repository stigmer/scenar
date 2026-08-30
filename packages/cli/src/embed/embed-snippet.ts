import type { Viewport } from "../pack/viewport.js";

/** Inputs for {@link buildEmbedSnippet}. */
export interface EmbedSnippetInput {
  /** The deploy's public embed URL (goes verbatim into the iframe `src`). */
  readonly embedUrl: string;
  /** Canonical viewport — pins the responsive box's aspect ratio + max width. */
  readonly viewport: Viewport;
  /** Optional human title for the iframe (a11y). Defaults to a generic label. */
  readonly title?: string;
}

/**
 * Build the responsive, framework-free `<iframe>` embed snippet — the default,
 * no-JS embed of DD-002. The wrapper pins the intrinsic aspect ratio
 * (`width / height` from the baked `ViewportConfig`, DD-004) with CSS
 * `aspect-ratio` so the embed scales fluidly to its container without
 * letterboxing or reflow, capped at the canonical width so it never upscales
 * past crispness.
 *
 * `allow="autoplay; fullscreen"` is the canonical host half of the embed
 * permission pair (DD-003) and matches the edge's `Permissions-Policy`; reuse it
 * verbatim. Attribute values are escaped, since the snippet is copy-pasted into
 * third-party HTML.
 *
 * The wrapper carries `overflow:hidden` so it honors the embed corner contract:
 * a host that adds `border-radius` to the wrapper gets cleanly clipped corners
 * (the embed paints edge-to-edge; the host boundary owns the radius, same as
 * `@scenar/embed`'s adapters).
 *
 * Pure function — returns the snippet string; the caller decides where to print.
 */
export function buildEmbedSnippet(input: EmbedSnippetInput): string {
  const { embedUrl, viewport } = input;
  const title = input.title ?? "Scenar embed";
  return [
    `<div style="position:relative;width:100%;max-width:${viewport.width}px;aspect-ratio:${viewport.width}/${viewport.height};overflow:hidden">`,
    `  <iframe`,
    `    src="${escapeAttr(embedUrl)}"`,
    `    title="${escapeAttr(title)}"`,
    `    loading="lazy"`,
    `    style="position:absolute;inset:0;width:100%;height:100%;border:0"`,
    `    allow="autoplay; fullscreen"`,
    `    allowfullscreen`,
    `  ></iframe>`,
    `</div>`,
  ].join("\n");
}

/**
 * Build the *enhanced* embed snippet — the optional `<scenar-embed>` loader of
 * DD-002/DD-005. A single `<script>` registers the custom element (the bundle's
 * sibling `embed.js`, copied in by `scenar pack`), and the tag then auto-fits to
 * the embed's reported size and syncs the host's light/dark theme. No viewport
 * math is needed in the snippet: the element adopts the embed's exact aspect
 * ratio from its first `resize`, falling back to the recorded baseline until then.
 *
 * The loader URL is resolved as `embed.js` relative to the embed URL, so it
 * points at the copy that ships inside the bundle (works on GitHub Pages, a
 * local `serve`, or any static host). Attribute values are escaped, since the
 * snippet is copy-pasted into third-party HTML.
 *
 * Pure function — returns the snippet string; the caller decides where to print.
 */
export function buildEnhancedEmbedSnippet(input: EmbedSnippetInput): string {
  const { embedUrl } = input;
  const title = input.title ?? "Scenar embed";
  const loaderUrl = new URL("embed.js", embedUrl).toString();
  return [
    `<script type="module" src="${escapeAttr(loaderUrl)}"></script>`,
    `<scenar-embed`,
    `  src="${escapeAttr(embedUrl)}"`,
    `  title="${escapeAttr(title)}"`,
    `></scenar-embed>`,
  ].join("\n");
}

/** Escape a string for safe interpolation into a double-quoted HTML attribute. */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
