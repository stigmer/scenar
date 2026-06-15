import { type RefObject, useCallback, useEffect, useRef } from "react";
import {
  type ScenarEmbedCommand,
  type ScenarEmbedEvent,
  type StepTimeline,
  frameEmbedEvent,
  parseEmbedCommand,
} from "@scenar/core";

type PlaybackState = "idle" | "playing" | "paused";

/** Imperative controls the host can drive over the bridge. */
export interface ScenarEmbedControls {
  play: () => void;
  pause: () => void;
  seekToTime: (timeMs: number) => void;
  setMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
  prefetch: () => void;
}

export interface UseScenarEmbedBridgeOptions {
  /**
   * Opt in to the bridge. The bridge additionally requires running inside a
   * cross-document frame (`window.parent !== window`); a non-framed or
   * server-rendered context is always a no-op. Keep this `false` for normal
   * in-app embedding so a host page never receives unexpected messages.
   */
  enabled: boolean;
  /** Container whose height changes are reported to the host. */
  containerRef: RefObject<HTMLElement | null>;
  playbackState: PlaybackState;
  stepIndex: number;
  totalSteps: number;
  /** Timeline used to derive the position fraction for `progress` events. */
  stepTimeline: StepTimeline;
  hasNarration: boolean;
  audioBlocked: boolean;
  controls: ScenarEmbedControls;
}

/**
 * Bridge a {@link ScenarioPlayer} to its host page over the `scenar` embed
 * postMessage protocol (v1).
 *
 * Outbound: lifecycle/position events (`ready`, `started`, `paused`,
 * `stepchange`, `progress`, `completed`, `audioBlocked`) and a `resize` event
 * driven by a `ResizeObserver`. Inbound: validated host commands
 * (`play`/`pause`/`seek`/`setMuted`/`setVolume`/`prefetch`/`destroy`).
 *
 * Security: inbound messages are accepted only from the direct framing window
 * (`event.source === window.parent`) and only when they parse as a well-formed,
 * versioned scenar command. The host origin is unknown for a third-party embed,
 * so outbound messages target `*` until the first valid command arrives, after
 * which they are pinned to that command's origin.
 */
export function useScenarEmbedBridge(options: UseScenarEmbedBridgeOptions): void {
  const framed = typeof window !== "undefined" && window.parent !== window;
  const active = options.enabled && framed;

  const activeRef = useRef(active);
  activeRef.current = active;

  // Pinned host origin: null until the host first speaks, then its origin.
  const hostOriginRef = useRef<string | null>(null);

  const controlsRef = useRef(options.controls);
  controlsRef.current = options.controls;

  const post = useCallback((event: ScenarEmbedEvent) => {
    if (!activeRef.current || typeof window === "undefined") return;
    window.parent.postMessage(frameEmbedEvent(event), hostOriginRef.current ?? "*");
  }, []);

  const dispatch = useCallback((command: ScenarEmbedCommand) => {
    const controls = controlsRef.current;
    switch (command.type) {
      case "play":
        controls.play();
        break;
      case "pause":
      case "destroy":
        // `destroy` stops playback; the host removes the iframe for full teardown.
        controls.pause();
        break;
      case "seek":
        controls.seekToTime(command.timeMs);
        break;
      case "setMuted":
        controls.setMuted(command.muted);
        break;
      case "setVolume":
        controls.setVolume(command.volume);
        break;
      case "prefetch":
        controls.prefetch();
        break;
    }
  }, []);

  // Inbound commands.
  useEffect(() => {
    if (!active) return;
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      const command = parseEmbedCommand(event.data);
      if (!command) return;
      if (event.origin && event.origin !== "null") hostOriginRef.current = event.origin;
      dispatch(command);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [active, dispatch]);

  // Resize reporting.
  useEffect(() => {
    if (!active) return;
    const el = options.containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      post({ type: "resize", widthPx: Math.round(rect.width), heightPx: Math.round(rect.height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [active, options.containerRef, post]);

  // ready (once on activation).
  const readySentRef = useRef(false);
  useEffect(() => {
    if (!active || readySentRef.current) return;
    readySentRef.current = true;
    post({ type: "ready", totalSteps: options.totalSteps, hasNarration: options.hasNarration });
  }, [active, post, options.totalSteps, options.hasNarration]);

  // started / paused / completed.
  const lastIndex = options.totalSteps - 1;
  useEffect(() => {
    if (!active) return;
    if (options.playbackState === "playing") {
      post({ type: "started" });
    } else if (options.playbackState === "paused") {
      post(options.stepIndex >= lastIndex ? { type: "completed" } : { type: "paused" });
    }
  }, [active, options.playbackState, options.stepIndex, lastIndex, post]);

  // stepchange + position checkpoint.
  useEffect(() => {
    if (!active) return;
    const total = options.stepTimeline.totalDurationMs;
    const start = options.stepTimeline.stepStartTimesMs[options.stepIndex] ?? 0;
    const fraction = total > 0 ? start / total : 0;
    post({ type: "stepchange", stepIndex: options.stepIndex, totalSteps: options.totalSteps });
    post({
      type: "progress",
      stepIndex: options.stepIndex,
      totalSteps: options.totalSteps,
      fraction,
    });
  }, [active, options.stepIndex, options.totalSteps, options.stepTimeline, post]);

  // audioBlocked.
  useEffect(() => {
    if (!active || !options.audioBlocked) return;
    post({ type: "audioBlocked" });
  }, [active, options.audioBlocked, post]);
}
