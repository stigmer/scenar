import { type EmbedMount, createEmbedMount } from "./mount.js";
import {
  type ScenarEmbedTheme,
  EMBED_BASE_ASPECT_HEIGHT,
  EMBED_BASE_ASPECT_WIDTH,
} from "./resolve.js";

/** The custom element tag name. */
export const SCENAR_EMBED_TAG = "scenar-embed";

/** Accessible iframe title when the host sets none. */
const DEFAULT_TITLE = "Interactive product tour";

/**
 * SSR-safe base: subclassing `HTMLElement` evaluates at module load, which would
 * throw in a non-DOM environment (server render). Fall back to a stub so this
 * module can be imported anywhere; the element is only ever *registered* in a
 * browser via {@link defineScenarEmbed}.
 */
const HTMLElementBase: typeof HTMLElement =
  typeof HTMLElement !== "undefined"
    ? HTMLElement
    : (class {} as unknown as typeof HTMLElement);

/**
 * `<scenar-embed src="…">` — a framework-agnostic, drop-in embed for a hosted
 * Scenar tour. It owns an internal iframe and its responsive box; all bridge
 * behavior (origin pinning, theme sync, resize → aspect-ratio) comes from
 * {@link createEmbedMount}, so the element holds no protocol logic of its own.
 *
 * Attributes:
 * - `src` (required) — the absolute embed URL.
 * - `title` — accessible iframe title (defaults to a generic label).
 * - `theme` — `auto` (default) | `light` | `dark`.
 *
 * Corners: the element is the one clipping surface — it carries
 * `overflow: hidden`, and the host rounds by styling `border-radius` on the
 * element itself. The internal iframe must NOT carry a radius: under
 * iframe-as-screen the mount lays it out at the canonical viewport and scales
 * it down with a transform, so an iframe radius lives in pre-transform space
 * and renders at `radius x scale` — a mismatched, mostly ineffective clip.
 *
 * Events: re-dispatches every embed event as a DOM `CustomEvent` named
 * `scenar:<type>` (e.g. `scenar:ready`, `scenar:completed`) with the event in
 * `detail`, so a vanilla host can listen without touching `postMessage`.
 *
 * Imperative transport (`play`/`pause`/`seek`/`setMuted`/`setVolume`) delegates
 * to the bridge; calls before the element has a `src` are no-ops.
 */
export class ScenarEmbedElement extends HTMLElementBase {
  static get observedAttributes(): string[] {
    return ["src", "title", "theme"];
  }

  private iframe: HTMLIFrameElement | null = null;
  private mount: EmbedMount | null = null;

  connectedCallback(): void {
    if (!this.iframe) this.render();
    this.attach();
  }

  disconnectedCallback(): void {
    this.mount?.destroy();
    this.mount = null;
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) return;
    if (name === "title") {
      if (this.iframe) this.iframe.setAttribute("title", this.titleAttr());
      return;
    }
    // A new src or theme rebuilds the bridge (and reloads the frame).
    if (this.isConnected) this.attach();
  }

  play(): void {
    this.mount?.controller.play();
  }

  pause(): void {
    this.mount?.controller.pause();
  }

  seek(timeMs: number): void {
    this.mount?.controller.seek(timeMs);
  }

  setMuted(muted: boolean): void {
    this.mount?.controller.setMuted(muted);
  }

  setVolume(volume: number): void {
    this.mount?.controller.setVolume(volume);
  }

  private titleAttr(): string {
    return this.getAttribute("title") ?? DEFAULT_TITLE;
  }

  private themeAttr(): ScenarEmbedTheme {
    const theme = this.getAttribute("theme");
    return theme === "light" || theme === "dark" ? theme : "auto";
  }

  private setAspectRatio(width: number, height: number): void {
    this.style.aspectRatio = `${width} / ${height}`;
  }

  /** Build the host box + the internal iframe (once). */
  private render(): void {
    this.style.display = "block";
    this.style.position = "relative";
    this.style.width = "100%";
    this.style.overflow = "hidden";
    this.setAspectRatio(EMBED_BASE_ASPECT_WIDTH, EMBED_BASE_ASPECT_HEIGHT);

    const iframe = document.createElement("iframe");
    iframe.setAttribute("title", this.titleAttr());
    iframe.setAttribute("loading", "lazy");
    iframe.setAttribute("allow", "autoplay; fullscreen");
    iframe.setAttribute("allowfullscreen", "");
    iframe.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0";

    this.appendChild(iframe);
    this.iframe = iframe;
  }

  /** (Re)create the bridge for the current `src`/`theme`. */
  private attach(): void {
    const src = this.getAttribute("src");
    if (!src || !this.iframe) return;

    this.mount?.destroy();
    this.mount = createEmbedMount(this.iframe, {
      src,
      theme: this.themeAttr(),
      onAspectRatio: ({ widthPx, heightPx }) => this.setAspectRatio(widthPx, heightPx),
      onEvent: (event) =>
        this.dispatchEvent(new CustomEvent(`scenar:${event.type}`, { detail: event })),
    });
  }
}

/**
 * Register `<scenar-embed>` (idempotent and SSR-safe). Pass a custom tag name to
 * register under a different element name. A no-op when the registry is absent
 * (server) or the tag is already defined.
 */
export function defineScenarEmbed(tagName: string = SCENAR_EMBED_TAG): void {
  if (typeof customElements === "undefined") return;
  if (customElements.get(tagName)) return;
  customElements.define(tagName, ScenarEmbedElement);
}
