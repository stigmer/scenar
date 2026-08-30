"use client";

import {
  type CSSProperties,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { ScenarEmbedEvent } from "@scenar/core";
import { type EmbedMount, createEmbedMount } from "./mount.js";
import {
  type EmbedSource,
  type ScenarEmbedTheme,
  EMBED_BASE_ASPECT_HEIGHT,
  EMBED_BASE_ASPECT_WIDTH,
  resolveEmbedSrc,
} from "./resolve.js";

/** Accessible iframe title when the host passes none. */
const DEFAULT_TITLE = "Interactive product tour";

/** Imperative transport exposed through a ref, driving the bridge. */
export interface ScenarEmbedHandle {
  play(): void;
  pause(): void;
  seek(timeMs: number): void;
  setMuted(muted: boolean): void;
  setVolume(volume: number): void;
}

export interface ScenarEmbedProps extends EmbedSource {
  /** Accessible iframe title (defaults to a generic label). */
  readonly title?: string;
  /** Theme strategy (default `auto`: track the host's `dark` class). */
  readonly theme?: ScenarEmbedTheme;
  /** Receive every well-formed event from the embed (ready/progress/etc.). */
  readonly onEvent?: (event: ScenarEmbedEvent) => void;
  /** Class applied to the responsive wrapper. */
  readonly className?: string;
  /** Extra styles merged onto the responsive wrapper. */
  readonly style?: CSSProperties;
}

/**
 * Embed a hosted Scenar tour as a responsive, theme-synced iframe — the React
 * sibling of `<scenar-embed>`. It is a thin adapter over {@link createEmbedMount}
 * (it does not render the custom element), so it carries no protocol logic and
 * stays free of web-component-in-React SSR/typing friction.
 *
 * SSR-safe: the iframe renders without a `src` on the server and on the first
 * client render, so hydration never mismatches; the effect then assigns the
 * themed `src` and adopts the embed's reported aspect ratio.
 *
 * Corners: the wrapper is the one clipping surface — it carries
 * `overflow: hidden`, and the host supplies any corner radius via `className`
 * or `style`. The iframe itself must NOT carry a `border-radius`: under
 * iframe-as-screen the mount lays the iframe out at the canonical viewport and
 * scales it down with a transform, so a radius on the iframe lives in
 * pre-transform space and renders at `radius x scale` — a mismatched, mostly
 * ineffective clip. The embed paints edge-to-edge and the host boundary owns
 * the corners.
 */
export const ScenarEmbed = forwardRef<ScenarEmbedHandle, ScenarEmbedProps>(
  function ScenarEmbed({ src, id, base, title, theme = "auto", onEvent, className, style }, ref) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const mountRef = useRef<EmbedMount | null>(null);
    const [ratio, setRatio] = useState(
      `${EMBED_BASE_ASPECT_WIDTH} / ${EMBED_BASE_ASPECT_HEIGHT}`,
    );

    // Latest onEvent without forcing a re-mount when the callback identity changes.
    const onEventRef = useRef(onEvent);
    onEventRef.current = onEvent;

    const resolvedSrc = resolveEmbedSrc({ src, id, base });

    useEffect(() => {
      const iframe = iframeRef.current;
      if (!iframe) return;
      const mount = createEmbedMount(iframe, {
        src: resolvedSrc,
        theme,
        onAspectRatio: ({ widthPx, heightPx }) => setRatio(`${widthPx} / ${heightPx}`),
        onEvent: (event) => onEventRef.current?.(event),
      });
      mountRef.current = mount;
      return () => {
        mount.destroy();
        mountRef.current = null;
      };
    }, [resolvedSrc, theme]);

    useImperativeHandle(
      ref,
      () => ({
        play: () => mountRef.current?.controller.play(),
        pause: () => mountRef.current?.controller.pause(),
        seek: (timeMs) => mountRef.current?.controller.seek(timeMs),
        setMuted: (muted) => mountRef.current?.controller.setMuted(muted),
        setVolume: (volume) => mountRef.current?.controller.setVolume(volume),
      }),
      [],
    );

    return (
      <div
        className={className}
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: ratio,
          overflow: "hidden",
          ...style,
        }}
      >
        <iframe
          ref={iframeRef}
          title={title ?? DEFAULT_TITLE}
          loading="lazy"
          allow="autoplay; fullscreen"
          allowFullScreen
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: 0,
          }}
        />
      </div>
    );
  },
);
