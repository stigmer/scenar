import { describe, it, expect, afterEach, vi } from "vitest";
import { createRef } from "react";
import { render, screen, act, cleanup } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { ScenarEmbed, type ScenarEmbedHandle } from "./react.js";

const SRC = "https://embed.example/tour/";
const ORIGIN = "https://embed.example";

afterEach(() => {
  cleanup();
  document.documentElement.className = "";
});

/** Pin a sentinel window (with a spyable postMessage) as the iframe's frame. */
function stubFrame(iframe: HTMLIFrameElement): { postMessage: ReturnType<typeof vi.fn> } {
  const postMessage = vi.fn();
  const frame = { postMessage } as unknown as MessageEventSource;
  Object.defineProperty(iframe, "contentWindow", { value: frame, configurable: true });
  return { postMessage };
}

function postResize(iframe: HTMLIFrameElement, widthPx: number, heightPx: number): void {
  const event = new MessageEvent("message", {
    data: { source: "scenar-embed", v: 1, type: "resize", widthPx, heightPx },
    origin: ORIGIN,
  });
  Object.defineProperty(event, "source", { value: iframe.contentWindow, configurable: true });
  act(() => {
    window.dispatchEvent(event);
  });
}

describe("ScenarEmbed (React)", () => {
  it("renders a responsive, lazy iframe and assigns the themed src after mount", () => {
    render(<ScenarEmbed src={SRC} title="Welcome tour" />);
    const iframe = screen.getByTitle("Welcome tour") as HTMLIFrameElement;
    stubFrame(iframe);

    expect(iframe.getAttribute("loading")).toBe("lazy");
    expect(iframe.getAttribute("allow")).toBe("autoplay; fullscreen");
    expect(iframe.src).toBe("https://embed.example/tour/?theme=light");

    const wrapper = iframe.parentElement as HTMLElement;
    expect(wrapper.style.aspectRatio).toBe("896 / 480");
  });

  it("resolves id + base into the embed src", () => {
    render(<ScenarEmbed id="welcome" base="https://embed.example/demos" title="t" />);
    const iframe = screen.getByTitle("t") as HTMLIFrameElement;
    stubFrame(iframe);
    expect(iframe.src).toBe("https://embed.example/demos/welcome/?theme=light");
  });

  it("does not render a src on the server (SSR-safe, no hydration mismatch)", () => {
    const markup = renderToStaticMarkup(<ScenarEmbed src={SRC} title="t" />);
    expect(markup).toContain("<iframe");
    expect(markup).not.toContain("src=");
  });

  it("adopts the reported aspect ratio and forwards events", () => {
    const onEvent = vi.fn();
    render(<ScenarEmbed src={SRC} title="t" onEvent={onEvent} />);
    const iframe = screen.getByTitle("t") as HTMLIFrameElement;
    stubFrame(iframe);

    postResize(iframe, 900, 520);

    const wrapper = iframe.parentElement as HTMLElement;
    expect(wrapper.style.aspectRatio).toBe("900 / 520");
    expect(onEvent).toHaveBeenCalledWith({ type: "resize", widthPx: 900, heightPx: 520 });
  });

  it("drives transport through the ref handle", () => {
    const ref = createRef<ScenarEmbedHandle>();
    render(<ScenarEmbed ref={ref} src={SRC} title="t" />);
    const iframe = screen.getByTitle("t") as HTMLIFrameElement;
    const { postMessage } = stubFrame(iframe);

    act(() => {
      ref.current?.play();
    });

    expect(postMessage).toHaveBeenCalledWith(
      { source: "scenar-embed", v: 1, type: "play" },
      ORIGIN,
    );
  });
});
