import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmbedHostController } from "./host-controller.js";
import {
  SCENAR_EMBED_PROTOCOL_VERSION,
  SCENAR_EMBED_SOURCE,
  type ScenarEmbedEvent,
  frameEmbedEvent,
} from "./protocol.js";

const EMBED_ORIGIN = "https://d-abc123.scenarusercontent.net";

let iframe: HTMLIFrameElement;
let post: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  iframe = document.createElement("iframe");
  document.body.appendChild(iframe);
  // An attached jsdom iframe has a real contentWindow; spy on its postMessage
  // so command framing/target-origin are observable without a live navigation.
  post = vi.spyOn(iframe.contentWindow as Window & typeof globalThis, "postMessage");
  post.mockImplementation(() => {});
});

afterEach(() => {
  iframe.remove();
  vi.restoreAllMocks();
});

function dispatchFromEmbed(
  data: unknown,
  origin: string = EMBED_ORIGIN,
  source: Window | null = iframe.contentWindow,
): void {
  window.dispatchEvent(new MessageEvent("message", { data, origin, source }));
}

describe("createEmbedHostController — commands", () => {
  it("frames each command and posts it to the pinned embed origin", () => {
    const controller = createEmbedHostController({ iframe, origin: EMBED_ORIGIN });

    controller.play();
    expect(post).toHaveBeenLastCalledWith(
      { source: SCENAR_EMBED_SOURCE, v: SCENAR_EMBED_PROTOCOL_VERSION, type: "play" },
      EMBED_ORIGIN,
    );

    controller.seek(1500);
    expect(post).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "seek", timeMs: 1500 }),
      EMBED_ORIGIN,
    );

    controller.setMuted(true);
    expect(post).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "setMuted", muted: true }),
      EMBED_ORIGIN,
    );

    controller.setVolume(0.25);
    expect(post).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "setVolume", volume: 0.25 }),
      EMBED_ORIGIN,
    );

    controller.setHostScale(0.7);
    expect(post).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "setHostScale", scale: 0.7 }),
      EMBED_ORIGIN,
    );

    controller.destroy();
  });
});

describe("createEmbedHostController — inbound events", () => {
  it("relays well-formed events from the pinned embed", () => {
    const onEvent = vi.fn<(event: ScenarEmbedEvent) => void>();
    createEmbedHostController({ iframe, origin: EMBED_ORIGIN }, { onEvent });

    dispatchFromEmbed(frameEmbedEvent({ type: "ready", totalSteps: 3, hasNarration: true }));
    expect(onEvent).toHaveBeenCalledWith({ type: "ready", totalSteps: 3, hasNarration: true });

    dispatchFromEmbed(frameEmbedEvent({ type: "progress", stepIndex: 1, totalSteps: 3, fraction: 0.5 }));
    expect(onEvent).toHaveBeenLastCalledWith({
      type: "progress",
      stepIndex: 1,
      totalSteps: 3,
      fraction: 0.5,
    });
  });

  it("ignores events from a foreign origin", () => {
    const onEvent = vi.fn<(event: ScenarEmbedEvent) => void>();
    createEmbedHostController({ iframe, origin: EMBED_ORIGIN }, { onEvent });

    dispatchFromEmbed(frameEmbedEvent({ type: "started" }), "https://evil.example");
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("ignores events from a different source window", () => {
    const onEvent = vi.fn<(event: ScenarEmbedEvent) => void>();
    createEmbedHostController({ iframe, origin: EMBED_ORIGIN }, { onEvent });

    // Correct origin but the message comes from the host window, not the iframe.
    dispatchFromEmbed(frameEmbedEvent({ type: "started" }), EMBED_ORIGIN, window);
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("ignores malformed or foreign-protocol payloads", () => {
    const onEvent = vi.fn<(event: ScenarEmbedEvent) => void>();
    createEmbedHostController({ iframe, origin: EMBED_ORIGIN }, { onEvent });

    dispatchFromEmbed({ source: "other-widget", v: 1, type: "ready", totalSteps: 1, hasNarration: false });
    dispatchFromEmbed({ source: SCENAR_EMBED_SOURCE, v: 999, type: "started" });
    dispatchFromEmbed({ hello: "world" });
    dispatchFromEmbed("started");
    expect(onEvent).not.toHaveBeenCalled();
  });
});

describe("createEmbedHostController — teardown", () => {
  it("destroy() tells the embed to stop and detaches the listener", () => {
    const onEvent = vi.fn<(event: ScenarEmbedEvent) => void>();
    const controller = createEmbedHostController({ iframe, origin: EMBED_ORIGIN }, { onEvent });

    controller.destroy();
    expect(post).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "destroy" }),
      EMBED_ORIGIN,
    );

    dispatchFromEmbed(frameEmbedEvent({ type: "started" }));
    expect(onEvent).not.toHaveBeenCalled();
  });
});
