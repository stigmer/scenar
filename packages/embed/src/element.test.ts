import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  type ScenarEmbedElement,
  SCENAR_EMBED_TAG,
  defineScenarEmbed,
} from "./element.js";

const SRC = "https://embed.example/tour/";
const ORIGIN = "https://embed.example";

beforeAll(() => {
  defineScenarEmbed();
});

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.className = "";
});

/**
 * Create, configure, and connect a `<scenar-embed>`; return it, its iframe, and
 * a sentinel `contentWindow` (with a no-op postMessage so the controller's
 * teardown `destroy` command is harmless, and so the per-frame `event.source`
 * check is genuinely exercised).
 */
function mountElement(
  attrs: Record<string, string>,
): { el: ScenarEmbedElement; iframe: HTMLIFrameElement; frame: MessageEventSource } {
  const el = document.createElement(SCENAR_EMBED_TAG) as ScenarEmbedElement;
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  document.body.appendChild(el);
  const iframe = el.querySelector("iframe") as HTMLIFrameElement;
  const frame = { postMessage: () => {} } as unknown as MessageEventSource;
  Object.defineProperty(iframe, "contentWindow", { value: frame, configurable: true });
  return { el, iframe, frame };
}

function postResize(widthPx: number, heightPx: number, source: MessageEventSource): void {
  const event = new MessageEvent("message", {
    data: { source: "scenar-embed", v: 1, type: "resize", widthPx, heightPx },
    origin: ORIGIN,
  });
  Object.defineProperty(event, "source", { value: source, configurable: true });
  window.dispatchEvent(event);
}

describe("defineScenarEmbed", () => {
  it("registers the tag once and is idempotent", () => {
    defineScenarEmbed();
    defineScenarEmbed();
    expect(customElements.get(SCENAR_EMBED_TAG)).toBeTruthy();
  });
});

describe("<scenar-embed>", () => {
  it("renders a lazy, autoplay-capable iframe inside a responsive box", () => {
    const { el, iframe } = mountElement({ src: SRC, title: "Welcome tour" });

    expect(iframe).toBeTruthy();
    expect(iframe.getAttribute("loading")).toBe("lazy");
    expect(iframe.getAttribute("allow")).toBe("autoplay; fullscreen");
    expect(iframe.hasAttribute("allowfullscreen")).toBe(true);
    expect(iframe.getAttribute("title")).toBe("Welcome tour");
    expect(el.style.position).toBe("relative");
    expect(el.style.aspectRatio).toBe("896 / 480");
  });

  it("falls back to a generic accessible title", () => {
    const { iframe } = mountElement({ src: SRC });
    expect(iframe.getAttribute("title")).toBe("Interactive product tour");
  });

  it("frames the tour with the host theme baked into src", () => {
    document.documentElement.classList.add("dark");
    const { iframe } = mountElement({ src: SRC });
    expect(iframe.src).toBe("https://embed.example/tour/?theme=dark");
  });

  it("updates the iframe title when the attribute changes (no reload)", () => {
    const { el, iframe } = mountElement({ src: SRC, title: "First" });
    const srcBefore = iframe.src;
    el.setAttribute("title", "Second");
    expect(iframe.getAttribute("title")).toBe("Second");
    expect(iframe.src).toBe(srcBefore);
  });

  it("adopts the reported aspect ratio and re-dispatches embed events", () => {
    const { el, frame } = mountElement({ src: SRC });

    const seen: unknown[] = [];
    el.addEventListener("scenar:resize", (e) => seen.push((e as CustomEvent).detail));

    postResize(900, 520, frame);

    expect(el.style.aspectRatio).toBe("900 / 520");
    expect(seen).toEqual([{ type: "resize", widthPx: 900, heightPx: 520 }]);
  });

  it("tears down on disconnect", () => {
    const { el, frame } = mountElement({ src: SRC });
    postResize(900, 520, frame);
    expect(el.style.aspectRatio).toBe("900 / 520");

    el.remove();
    postResize(640, 360, frame);
    expect(el.style.aspectRatio).toBe("900 / 520");
  });
});
