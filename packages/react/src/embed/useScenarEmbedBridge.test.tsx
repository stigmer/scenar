import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import {
  SCENAR_EMBED_PROTOCOL_VERSION,
  SCENAR_EMBED_SOURCE,
  type ScenarEmbedEvent,
  type StepTimeline,
  frameEmbedCommand,
} from "@scenar/core";
import { type ScenarEmbedControls, useScenarEmbedBridge } from "./useScenarEmbedBridge.js";

const TIMELINE: StepTimeline = { stepStartTimesMs: [0, 1000, 2000], totalDurationMs: 3000 };

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  callback: ResizeObserverCallback;
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }
}

function makeControls(): ScenarEmbedControls {
  return {
    play: vi.fn(),
    pause: vi.fn(),
    seekToTime: vi.fn(),
    setMuted: vi.fn(),
    setVolume: vi.fn(),
    setHostScale: vi.fn(),
    prefetch: vi.fn(),
  };
}

function BridgeHarness(props: {
  enabled: boolean;
  controls: ScenarEmbedControls;
  playbackState?: "idle" | "playing" | "paused";
  stepIndex?: number;
  audioBlocked?: boolean;
  viewport?: { widthPx: number; heightPx: number };
}) {
  const ref = useRef<HTMLDivElement>(null);
  useScenarEmbedBridge({
    enabled: props.enabled,
    containerRef: ref,
    playbackState: props.playbackState ?? "idle",
    stepIndex: props.stepIndex ?? 0,
    totalSteps: 3,
    stepTimeline: TIMELINE,
    hasNarration: true,
    audioBlocked: props.audioBlocked ?? false,
    viewport: props.viewport,
    controls: props.controls,
  });
  return <div ref={ref} />;
}

const mockParent = { postMessage: vi.fn() };
const HOST_ORIGIN = "https://host.example";

function dispatchFromParent(data: unknown, origin = HOST_ORIGIN) {
  window.dispatchEvent(
    new MessageEvent("message", { data, origin, source: mockParent as unknown as Window }),
  );
}

function postedEvents(): ScenarEmbedEvent[] {
  return mockParent.postMessage.mock.calls.map((call) => call[0] as ScenarEmbedEvent);
}

beforeEach(() => {
  mockParent.postMessage.mockReset();
  MockResizeObserver.instances = [];
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function makeFramed() {
  vi.spyOn(window, "parent", "get").mockReturnValue(mockParent as unknown as Window);
}

describe("useScenarEmbedBridge", () => {
  it("is inert when not running inside a frame", () => {
    const controls = makeControls();
    render(<BridgeHarness enabled controls={controls} />);

    // window.parent === window here, so the bridge never activates.
    window.dispatchEvent(
      new MessageEvent("message", {
        data: frameEmbedCommand({ type: "play" }),
        origin: HOST_ORIGIN,
        source: window,
      }),
    );

    expect(controls.play).not.toHaveBeenCalled();
    expect(mockParent.postMessage).not.toHaveBeenCalled();
  });

  it("emits ready on mount when framed", () => {
    makeFramed();
    render(<BridgeHarness enabled controls={makeControls()} />);

    const ready = postedEvents().find((e) => e.type === "ready");
    expect(ready).toMatchObject({ type: "ready", totalSteps: 3, hasNarration: true });
    expect(ready).toMatchObject({ source: SCENAR_EMBED_SOURCE, v: SCENAR_EMBED_PROTOCOL_VERSION });
    // No viewport option -> the field must be genuinely absent from the wire
    // message; hosts branch on it to decide iframe-as-screen adoption.
    expect(ready && "viewport" in ready).toBe(false);
  });

  it("carries the canonical viewport on ready when provided", () => {
    makeFramed();
    render(
      <BridgeHarness
        enabled
        controls={makeControls()}
        viewport={{ widthPx: 1440, heightPx: 900 }}
      />,
    );

    const ready = postedEvents().find((e) => e.type === "ready");
    expect(ready).toMatchObject({
      type: "ready",
      viewport: { widthPx: 1440, heightPx: 900 },
    });
  });

  it("dispatches setHostScale to the optional control", () => {
    makeFramed();
    const controls = makeControls();
    render(<BridgeHarness enabled controls={controls} />);

    dispatchFromParent(frameEmbedCommand({ type: "setHostScale", scale: 0.7 }));
    expect(controls.setHostScale).toHaveBeenCalledWith(0.7);
  });

  it("tolerates setHostScale when the player wires no counter-scale", () => {
    makeFramed();
    const controls = makeControls();
    delete (controls as { setHostScale?: unknown }).setHostScale;
    render(<BridgeHarness enabled controls={controls} />);

    // Must not throw: the control is optional (standalone players and
    // exports have no viewport chrome layer to counter-scale).
    dispatchFromParent(frameEmbedCommand({ type: "setHostScale", scale: 0.7 }));
    expect(controls.play).not.toHaveBeenCalled();
  });

  it("dispatches a valid command from the framing window", () => {
    makeFramed();
    const controls = makeControls();
    render(<BridgeHarness enabled controls={controls} />);

    dispatchFromParent(frameEmbedCommand({ type: "play" }));
    expect(controls.play).toHaveBeenCalledTimes(1);

    dispatchFromParent(frameEmbedCommand({ type: "seek", timeMs: 500 }));
    expect(controls.seekToTime).toHaveBeenCalledWith(500);

    dispatchFromParent(frameEmbedCommand({ type: "setMuted", muted: true }));
    expect(controls.setMuted).toHaveBeenCalledWith(true);
  });

  it("ignores commands from a foreign source window", () => {
    makeFramed();
    const controls = makeControls();
    render(<BridgeHarness enabled controls={controls} />);

    window.dispatchEvent(
      new MessageEvent("message", {
        data: frameEmbedCommand({ type: "play" }),
        origin: "https://evil.example",
        source: {} as unknown as Window,
      }),
    );

    expect(controls.play).not.toHaveBeenCalled();
  });

  it("ignores malformed or unversioned payloads", () => {
    makeFramed();
    const controls = makeControls();
    render(<BridgeHarness enabled controls={controls} />);

    dispatchFromParent({ source: "other-widget", type: "play" });
    dispatchFromParent({ hello: "world" });
    dispatchFromParent("play");

    expect(controls.play).not.toHaveBeenCalled();
  });

  it("pins outbound targetOrigin to the host after its first command", () => {
    makeFramed();
    const { rerender } = render(<BridgeHarness enabled controls={makeControls()} />);

    // Before the host speaks, events go to any origin.
    expect(mockParent.postMessage.mock.calls[0]?.[1]).toBe("*");

    dispatchFromParent(frameEmbedCommand({ type: "play" }), HOST_ORIGIN);
    mockParent.postMessage.mockReset();

    // A subsequent step change now targets the pinned origin.
    rerender(<BridgeHarness enabled controls={makeControls()} stepIndex={1} />);

    const lastCall = mockParent.postMessage.mock.calls.at(-1);
    expect(lastCall?.[1]).toBe(HOST_ORIGIN);
  });

  it("emits resize when the container resizes", () => {
    makeFramed();
    render(<BridgeHarness enabled controls={makeControls()} />);

    act(() => {
      MockResizeObserver.instances.at(-1)?.callback([], {} as ResizeObserver);
    });

    expect(postedEvents().some((e) => e.type === "resize")).toBe(true);
  });

  it("emits stepchange + progress for the active step", () => {
    makeFramed();
    render(<BridgeHarness enabled controls={makeControls()} stepIndex={1} />);

    const events = postedEvents();
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "stepchange", stepIndex: 1, totalSteps: 3 }),
        expect.objectContaining({
          type: "progress",
          stepIndex: 1,
          totalSteps: 3,
          fraction: 1000 / 3000,
        }),
      ]),
    );
  });
});
