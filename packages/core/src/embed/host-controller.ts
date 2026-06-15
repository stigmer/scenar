import {
  type ScenarEmbedCommand,
  type ScenarEmbedEvent,
  frameEmbedCommand,
  parseEmbedEvent,
} from "./protocol.js";

/**
 * The embed iframe this controller drives. Commands post to its
 * `contentWindow`, read at send time because it changes across (re)loads.
 */
export interface ScenarEmbedHostTarget {
  readonly iframe: HTMLIFrameElement;
  /**
   * The embed's exact origin — scheme + host + port, no path
   * (e.g. `https://d-<deployId>.scenarusercontent.net`). Both inbound events
   * and outbound commands are pinned to it. Derive it from the embed URL with
   * `new URL(embedUrl).origin`.
   */
  readonly origin: string;
}

export interface ScenarEmbedHostOptions {
  /** Invoked for every well-formed event received from the pinned embed. */
  readonly onEvent?: (event: ScenarEmbedEvent) => void;
}

/** Imperative handle for driving an embedded player from its host page. */
export interface ScenarEmbedHostController {
  play(): void;
  pause(): void;
  seek(timeMs: number): void;
  setMuted(muted: boolean): void;
  setVolume(volume: number): void;
  prefetch(): void;
  /**
   * Tell the embed to stop (best effort) and detach the host message listener.
   * The host still owns the iframe element; remove it separately for full
   * teardown.
   */
  destroy(): void;
}

/**
 * Drive an embedded {@link https://www.npmjs.com/package/@scenar/react | ScenarioPlayer}
 * from its host page over the `scenar` embed postMessage protocol (v1).
 *
 * This is the exact inverse of `useScenarEmbedBridge` (the embed-side runtime in
 * `@scenar/react`): it sends the commands that bridge receives and receives the
 * events that bridge sends. It is framework-free so both the React console
 * preview and a vanilla `embed.js` loader share one host implementation.
 *
 * Security: unlike the embed side — which cannot know its host's origin ahead of
 * time and so pins on the first inbound message — the host already knows the
 * embed's exact origin, so this controller pins from the start. An inbound
 * message is accepted only when it both comes from this iframe's window
 * (`event.source === iframe.contentWindow`) and carries the pinned `origin`.
 * The global `message` channel is shared with the host page and every other
 * widget, so both checks are required.
 */
export function createEmbedHostController(
  target: ScenarEmbedHostTarget,
  options: ScenarEmbedHostOptions = {},
): ScenarEmbedHostController {
  const { iframe, origin } = target;
  const { onEvent } = options;
  const canListen = typeof window !== "undefined";

  const send = (command: ScenarEmbedCommand): void => {
    iframe.contentWindow?.postMessage(frameEmbedCommand(command), origin);
  };

  const onMessage = (event: MessageEvent): void => {
    if (event.source !== iframe.contentWindow) return;
    if (event.origin !== origin) return;
    const parsed = parseEmbedEvent(event.data);
    if (!parsed) return;
    onEvent?.(parsed);
  };

  if (canListen) window.addEventListener("message", onMessage);

  return {
    play: () => send({ type: "play" }),
    pause: () => send({ type: "pause" }),
    seek: (timeMs) => send({ type: "seek", timeMs }),
    setMuted: (muted) => send({ type: "setMuted", muted }),
    setVolume: (volume) => send({ type: "setVolume", volume }),
    prefetch: () => send({ type: "prefetch" }),
    destroy: () => {
      send({ type: "destroy" });
      if (canListen) window.removeEventListener("message", onMessage);
    },
  };
}
