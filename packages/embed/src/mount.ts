import {
  type ScenarEmbedEvent,
  type ScenarEmbedHostController,
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

  const controller = createEmbedHostController(
    { iframe, origin },
    {
      onEvent: (event) => {
        if (event.type === "resize") {
          onAspectRatio?.({ widthPx: event.widthPx, heightPx: event.heightPx });
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
      controller.destroy();
    },
  };
}
