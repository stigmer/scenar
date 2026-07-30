import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { type EmbedAspectRatio, type EmbedMount, createEmbedMount } from "./mount.js";

const SRC = "https://embed.example/tour/";
const ORIGIN = "https://embed.example";

/** Build a framed Scenar embed resize message (protocol v1). */
function resizeMessage(widthPx: unknown, heightPx: unknown) {
  return { source: "scenar-embed", v: 1, type: "resize", widthPx, heightPx };
}

/**
 * Dispatch a window `message` event, attributed to a given origin and source
 * window. The controller adopts a message only when both the origin matches the
 * pinned embed origin and the source is the embed's own iframe window.
 */
function post(
  data: unknown,
  { origin = ORIGIN, source = null as MessageEventSource | null } = {},
) {
  const event = new MessageEvent("message", { data, origin });
  Object.defineProperty(event, "source", { value: source, configurable: true });
  window.dispatchEvent(event);
}

/**
 * A detached iframe never navigates when its `src` is set (no browsing context),
 * so tests can assert on `iframe.src` without jsdom navigation noise. We pin a
 * unique sentinel as its `contentWindow` so the controller's per-frame
 * `event.source` check is genuinely exercised.
 */
function makeIframe(): { iframe: HTMLIFrameElement; frame: MessageEventSource } {
  const iframe = document.createElement("iframe");
  // The controller posts commands to contentWindow (e.g. `destroy` on teardown),
  // so the sentinel must carry a postMessage.
  const frame = { postMessage: () => {} } as unknown as MessageEventSource;
  Object.defineProperty(iframe, "contentWindow", { value: frame, configurable: true });
  return { iframe, frame };
}

/** Let queued MutationObserver callbacks deliver. */
function flushMicrotasks(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

let mounts: EmbedMount[] = [];
function track(mount: EmbedMount): EmbedMount {
  mounts.push(mount);
  return mount;
}

beforeEach(() => {
  document.documentElement.className = "";
});

afterEach(() => {
  for (const mount of mounts) mount.destroy();
  mounts = [];
  document.documentElement.className = "";
});

describe("createEmbedMount — theme", () => {
  it("applies ?theme=light by default (no dark class on <html>)", () => {
    const { iframe } = makeIframe();
    track(createEmbedMount(iframe, { src: SRC }));
    expect(iframe.src).toBe("https://embed.example/tour/?theme=light");
  });

  it("applies ?theme=dark when the host is dark", () => {
    document.documentElement.classList.add("dark");
    const { iframe } = makeIframe();
    track(createEmbedMount(iframe, { src: SRC }));
    expect(iframe.src).toBe("https://embed.example/tour/?theme=dark");
  });

  it("pins a fixed theme regardless of the host (theme=dark)", () => {
    const { iframe } = makeIframe();
    track(createEmbedMount(iframe, { src: SRC, theme: "dark" }));
    expect(iframe.src).toBe("https://embed.example/tour/?theme=dark");
  });

  it("reloads in the new theme when the host toggles dark mode (auto)", async () => {
    const { iframe } = makeIframe();
    track(createEmbedMount(iframe, { src: SRC, theme: "auto" }));
    expect(iframe.src).toContain("theme=light");

    document.documentElement.classList.add("dark");
    await flushMicrotasks();
    expect(iframe.src).toContain("theme=dark");

    document.documentElement.classList.remove("dark");
    await flushMicrotasks();
    expect(iframe.src).toContain("theme=light");
  });

  it("does not observe the host when the theme is pinned", async () => {
    const { iframe } = makeIframe();
    track(createEmbedMount(iframe, { src: SRC, theme: "light" }));
    document.documentElement.classList.add("dark");
    await flushMicrotasks();
    expect(iframe.src).toContain("theme=light");
  });
});

describe("createEmbedMount — resize → aspect ratio", () => {
  it("reports the exact size from a valid resize sent by its own frame", () => {
    const ratios: EmbedAspectRatio[] = [];
    const { iframe, frame } = makeIframe();
    track(createEmbedMount(iframe, { src: SRC, onAspectRatio: (r) => ratios.push(r) }));

    post(resizeMessage(900, 520), { source: frame });

    expect(ratios).toEqual([{ widthPx: 900, heightPx: 520 }]);
  });

  it("routes each resize only to the frame that sent it (two embeds, one page)", () => {
    const aRatios: EmbedAspectRatio[] = [];
    const bRatios: EmbedAspectRatio[] = [];
    const a = makeIframe();
    const b = makeIframe();
    track(createEmbedMount(a.iframe, { src: SRC, onAspectRatio: (r) => aRatios.push(r) }));
    track(createEmbedMount(b.iframe, { src: SRC, onAspectRatio: (r) => bRatios.push(r) }));

    post(resizeMessage(700, 400), { source: b.frame });
    expect(bRatios).toEqual([{ widthPx: 700, heightPx: 400 }]);
    expect(aRatios).toEqual([]);

    post(resizeMessage(1000, 300), { source: a.frame });
    expect(aRatios).toEqual([{ widthPx: 1000, heightPx: 300 }]);
    expect(bRatios).toEqual([{ widthPx: 700, heightPx: 400 }]);
  });
});

describe("createEmbedMount — ignores messages that do not match the contract", () => {
  let iframe: HTMLIFrameElement;
  let frame: MessageEventSource;
  let onAspectRatio: ReturnType<typeof vi.fn>;
  let onEvent: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ({ iframe, frame } = makeIframe());
    onAspectRatio = vi.fn();
    onEvent = vi.fn();
    track(createEmbedMount(iframe, { src: SRC, onAspectRatio, onEvent }));
  });

  it("rejects a spoofed origin", () => {
    post(resizeMessage(900, 520), { origin: "https://evil.example", source: frame });
    expect(onAspectRatio).not.toHaveBeenCalled();
  });

  it("rejects a resize from a frame it does not own", () => {
    post(resizeMessage(900, 520), { source: window });
    expect(onAspectRatio).not.toHaveBeenCalled();
  });

  it("rejects a foreign source tag", () => {
    post({ source: "other-widget", v: 1, type: "resize", widthPx: 9, heightPx: 5 }, { source: frame });
    expect(onAspectRatio).not.toHaveBeenCalled();
  });

  it("rejects a mismatched protocol version", () => {
    post({ source: "scenar-embed", v: 999, type: "resize", widthPx: 9, heightPx: 5 }, { source: frame });
    expect(onAspectRatio).not.toHaveBeenCalled();
  });

  it("rejects a malformed payload", () => {
    post(resizeMessage("huge", 520), { source: frame });
    post(resizeMessage(900, Number.NaN), { source: frame });
    post("not-an-object", { source: frame });
    expect(onAspectRatio).not.toHaveBeenCalled();
  });

  it("still forwards non-resize events to onEvent without touching layout", () => {
    post({ source: "scenar-embed", v: 1, type: "completed" }, { source: frame });
    expect(onEvent).toHaveBeenCalledWith({ type: "completed" });
    expect(onAspectRatio).not.toHaveBeenCalled();
  });
});

/** Build a framed ready message (protocol v1), optionally carrying a viewport. */
function readyMessage(viewport?: { widthPx: number; heightPx: number }) {
  return {
    source: "scenar-embed",
    v: 1,
    type: "ready",
    totalSteps: 3,
    hasNarration: false,
    ...(viewport ? { viewport } : {}),
  };
}

/**
 * Give an iframe a positioned wrapper of a fixed layout size (the adapter
 * contract the mount scales against). jsdom computes no layout, so the
 * wrapper's rect is stubbed.
 */
function wrapInSizedWrapper(
  iframe: HTMLIFrameElement,
  width: number,
  height: number,
): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.style.position = "relative";
  vi.spyOn(wrapper, "getBoundingClientRect").mockReturnValue({
    width,
    height,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
  wrapper.appendChild(iframe);
  document.body.appendChild(wrapper);
  return wrapper;
}

describe("createEmbedMount — iframe-as-screen (ready carries a viewport)", () => {
  it("lays the iframe out at the canonical size, scaled to fit the wrapper", () => {
    const { iframe, frame } = makeIframe();
    const send = vi.fn();
    (frame as { postMessage: unknown }).postMessage = send;
    // 896-wide wrapper for a 1440x900 canonical viewport: scale 896/1440.
    wrapInSizedWrapper(iframe, 896, 560);
    track(createEmbedMount(iframe, { src: SRC }));

    post(readyMessage({ widthPx: 1440, heightPx: 900 }), { source: frame });

    const scale = 896 / 1440;
    expect(iframe.style.width).toBe("1440px");
    expect(iframe.style.height).toBe("900px");
    expect(iframe.style.transformOrigin).toBe("0 0");
    expect(iframe.style.transform).toBe(`translate(0px, 0px) scale(${scale})`);
  });

  it("reports the applied scale back to the embed over setHostScale", () => {
    const { iframe, frame } = makeIframe();
    const send = vi.fn();
    (frame as { postMessage: unknown }).postMessage = send;
    wrapInSizedWrapper(iframe, 720, 450);
    track(createEmbedMount(iframe, { src: SRC }));

    post(readyMessage({ widthPx: 1440, heightPx: 900 }), { source: frame });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "setHostScale", scale: 0.5 }),
      ORIGIN,
    );
  });

  it("caps the scale at 1 and centers the frame in a wider-than-canonical wrapper", () => {
    const { iframe, frame } = makeIframe();
    (frame as { postMessage: unknown }).postMessage = vi.fn();
    wrapInSizedWrapper(iframe, 2000, 1100);
    track(createEmbedMount(iframe, { src: SRC }));

    post(readyMessage({ widthPx: 1440, heightPx: 900 }), { source: frame });

    // scale 1; centered: x = (2000 - 1440) / 2 = 280, y = (1100 - 900) / 2 = 100.
    expect(iframe.style.transform).toBe("translate(280px, 100px) scale(1)");
  });

  it("leaves the iframe's fill layout untouched for pre-viewport bundles", () => {
    const { iframe, frame } = makeIframe();
    (frame as { postMessage: unknown }).postMessage = vi.fn();
    wrapInSizedWrapper(iframe, 896, 560);
    track(createEmbedMount(iframe, { src: SRC }));

    post(readyMessage(), { source: frame });

    // The version-skew contract: an old bundle (no viewport on ready) keeps
    // exactly the fit-inside-the-iframe behavior — no size, no transform.
    expect(iframe.style.width).toBe("");
    expect(iframe.style.transform).toBe("");
  });
});

describe("createEmbedMount — teardown", () => {
  it("stops reacting to resizes after destroy", () => {
    const ratios: EmbedAspectRatio[] = [];
    const { iframe, frame } = makeIframe();
    const mount = createEmbedMount(iframe, { src: SRC, onAspectRatio: (r) => ratios.push(r) });

    mount.destroy();
    post(resizeMessage(900, 520), { source: frame });
    expect(ratios).toEqual([]);
  });

  it("stops observing host theme after destroy", async () => {
    const { iframe } = makeIframe();
    const mount = createEmbedMount(iframe, { src: SRC, theme: "auto" });
    expect(iframe.src).toContain("theme=light");

    mount.destroy();
    document.documentElement.classList.add("dark");
    await flushMicrotasks();
    expect(iframe.src).toContain("theme=light");
  });
});
