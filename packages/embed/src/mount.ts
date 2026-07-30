import {
  type ScenarEmbedEvent,
  type ScenarEmbedHostController,
  type ScenarEmbedViewport,
  createEmbedHostController,
} from "@scenar/core";
import {
  type ScenarEmbedTheme,
  applyThemeToSrc,
  originFromSrc,
  resolveTheme,
} from "./resolve.js";

/** The embed's exact rendered size, reported over the `resize` event. */
export interface EmbedAspectRatio {
  readonly widthPx: number;
  readonly heightPx: number;
}

/** Options for {@link createEmbedMount}. */
export interface EmbedMountOptions {
  /** The absolute embed URL, without a theme query (the mount adds it). */
  readonly src: string;
  /** Theme strategy (default `auto`). */
  readonly theme?: ScenarEmbedTheme;
  /** Called whenever the embed reports a new rendered size, for host layout. */
  readonly onAspectRatio?: (ratio: EmbedAspectRatio) => void;
  /** Called for every well-formed event from the pinned embed. */
  readonly onEvent?: (event: ScenarEmbedEvent) => void;
}

/** A live mount: the host controller plus a teardown for all listeners. */
export interface EmbedMount {
  /** Imperative transport (play/pause/seek/setMuted/setVolume) over the bridge. */
  readonly controller: ScenarEmbedHostController;
  /** Disconnect the theme observer and the controller's message listener. */
  destroy(): void;
}

/** Whether the host page is in dark mode (the `dark` class on `<html>`). */
function hostPrefersDark(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
  );
}

/**
 * Wire an existing iframe to a hosted Scenar tour: set its themed `src`, pin the
 * embed origin, adopt the embed's reported aspect ratio, and (for `theme:auto`)
 * track the host's dark mode.
 *
 * This is the one place the loader's behavior lives. The `<scenar-embed>`
 * element and the React `<ScenarEmbed>` are thin adapters that create the iframe
 * + own layout, then hand it here — so neither re-implements the bridge, exactly
 * as {@link createEmbedHostController} is shared by the console and this loader.
 *
 * Iframe-as-screen (scenar-cloud DD-008's principle, applied to the frame):
 * when the bundle's `ready` event carries its canonical viewport, the mount
 * lays the iframe out at exactly that CSS-pixel size and scales it to the
 * wrapper with a `transform` — instead of letting the iframe track the wrapper
 * and scaling *inside* the document. The embedded document's viewport is then
 * the canonical viewport, so its media queries resolve as they would in a
 * real browser window of that size; the one scale factor per frame lives out
 * here, at the true boundary. `transform` and not CSS `zoom` on purpose:
 * transform is paint-level and never propagates into the child document, so
 * the inner viewport stays canonical. The mount reports the factor back over
 * `setHostScale` so the player's chrome layer can counter-scale its controls
 * to native pixel size. Bundles packed before the viewport field keep the
 * fit-inside-the-iframe behavior — both directions of version skew degrade
 * to exactly the pre-mode rendering.
 *
 * Layout contract with the adapters: the iframe fills a positioned wrapper
 * (`position: relative/absolute` box whose aspect ratio tracks the reported
 * embed size). The mount measures that wrapper — `iframe.parentElement` — to
 * derive the scale, and owns the iframe's `width`/`height`/`transform` once
 * (and only once) a viewport-carrying `ready` arrives.
 *
 * The caller owns the iframe element (and removes it for full teardown); this
 * function owns only the listeners it adds, all released by {@link EmbedMount.destroy}.
 */
export function createEmbedMount(
  iframe: HTMLIFrameElement,
  options: EmbedMountOptions,
): EmbedMount {
  const { src, theme = "auto", onAspectRatio, onEvent } = options;
  const origin = originFromSrc(src);

  // Track the last applied theme so an unrelated `<html>` class mutation never
  // triggers a needless reload — only a real light/dark flip reassigns `src`.
  let appliedTheme: "light" | "dark" | null = null;
  const applyTheme = (): void => {
    const resolved = resolveTheme(theme, hostPrefersDark());
    if (resolved === appliedTheme) return;
    appliedTheme = resolved;
    iframe.src = applyThemeToSrc(src, resolved);
  };

  // Iframe-as-screen state: set by the first viewport-carrying `ready`, then
  // kept in sync with the wrapper by a ResizeObserver. A theme flip reloads
  // the iframe and replays `ready`, which simply re-applies.
  let canonicalViewport: ScenarEmbedViewport | null = null;
  let wrapperObserver: ResizeObserver | undefined;
  let lastPostedScale: number | null = null;

  const applyViewportScale = (): void => {
    const wrapper = iframe.parentElement;
    if (!canonicalViewport || !wrapper) return;
    const { widthPx, heightPx } = canonicalViewport;
    const rect = wrapper.getBoundingClientRect();
    if (rect.width <= 0) return;
    // Cap at 1 like the in-document viewport does: upscaling past native
    // renders soft. Wider-than-canonical wrappers center the frame instead.
    const scale = Math.min(rect.width / widthPx, 1);
    const offsetX = (rect.width - widthPx * scale) / 2;
    const offsetY = (rect.height - heightPx * scale) / 2;
    iframe.style.width = `${widthPx}px`;
    iframe.style.height = `${heightPx}px`;
    iframe.style.transformOrigin = "0 0";
    iframe.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    if (scale !== lastPostedScale) {
      lastPostedScale = scale;
      controller.setHostScale(scale);
    }
  };

  const adoptViewport = (viewport: ScenarEmbedViewport): void => {
    canonicalViewport = viewport;
    applyViewportScale();
    if (!wrapperObserver && typeof ResizeObserver !== "undefined" && iframe.parentElement) {
      wrapperObserver = new ResizeObserver(applyViewportScale);
      wrapperObserver.observe(iframe.parentElement);
    }
  };

  const controller = createEmbedHostController(
    { iframe, origin },
    {
      onEvent: (event) => {
        if (event.type === "resize") {
          onAspectRatio?.({ widthPx: event.widthPx, heightPx: event.heightPx });
        }
        if (event.type === "ready" && event.viewport) {
          adoptViewport(event.viewport);
        }
        onEvent?.(event);
      },
    },
  );

  let observer: MutationObserver | undefined;
  if (
    theme === "auto" &&
    typeof MutationObserver !== "undefined" &&
    typeof document !== "undefined"
  ) {
    observer = new MutationObserver(applyTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  // Assign the initial themed src last, so the controller's listener is already
  // attached when the frame begins loading.
  applyTheme();

  return {
    controller,
    destroy() {
      observer?.disconnect();
      wrapperObserver?.disconnect();
      controller.destroy();
    },
  };
}
