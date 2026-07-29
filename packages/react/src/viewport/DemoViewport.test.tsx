import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { DemoViewport } from "./DemoViewport.js";
import { useViewportChromeTarget } from "./ViewportChrome.js";
import { VideoExportProvider } from "../video/VideoExportContext.js";

// jsdom ships no ResizeObserver; the component observes its wrapper to
// compute zoom. An inert stub is enough — zoom math is a layout concern
// verified in the browser harness, not here.
beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(cleanup);

/**
 * jsdom has no layout engine, so the zoom *computation* (ResizeObserver ->
 * `width / canonicalWidth`) is not exercisable here — that is covered by the
 * browser-level screenshot harness. What jsdom can verify is the rendered
 * contract: which widths and caps the component writes into the DOM.
 */
describe("DemoViewport", () => {
  it("lays out the inner canvas at the canonical width", () => {
    const { container } = render(
      <DemoViewport canonicalWidth={1280}>
        <p>content</p>
      </DemoViewport>,
    );
    const inner = container.firstElementChild!.firstElementChild as HTMLElement;
    expect(inner.style.width).toBe("1280px");
  });

  it("caps the default wrapper at the canonical width so the two cannot drift", () => {
    // Regression lock: the wrapper cap used to be a hardcoded `max-w-4xl`
    // (896px) that silently pinned zoom at 896/canonicalWidth for any larger
    // canonical width. The cap must track `canonicalWidth`.
    const { container } = render(
      <DemoViewport canonicalWidth={1280}>
        <p>content</p>
      </DemoViewport>,
    );
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.style.maxWidth).toBe("1280px");
    expect(outer.className).not.toContain("max-w-4xl");
  });

  it("caps the default wrapper at the default canonical width when none is given", () => {
    const { container } = render(
      <DemoViewport>
        <p>content</p>
      </DemoViewport>,
    );
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.style.maxWidth).toBe("896px");
  });

  it("leaves width control to the caller when wrapperClassName is overridden", () => {
    const { container } = render(
      <DemoViewport canonicalWidth={1280} wrapperClassName="relative w-full">
        <p>content</p>
      </DemoViewport>,
    );
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.style.maxWidth).toBe("");
    expect(outer.className).toBe("relative w-full");
  });

  it("exposes shellHeight as the --scenar-shell-height variable on the canvas", () => {
    const { container } = render(
      <DemoViewport canonicalWidth={1280} shellHeight={800}>
        <p>content</p>
      </DemoViewport>,
    );
    const inner = container.firstElementChild!.firstElementChild as HTMLElement;
    expect(inner.style.getPropertyValue("--scenar-shell-height")).toBe("800px");
  });
});

describe("DemoViewport chrome layer", () => {
  /** Renders the context value into the DOM so tests can assert identity. */
  function ChromeProbe() {
    const target = useViewportChromeTarget();
    return <p data-testid="probe">{target ? "target" : "null"}</p>;
  }

  it("provides children an unscaled overlay OUTSIDE the zoomed canvas", () => {
    let captured: HTMLElement | null = null;
    function Capture() {
      captured = useViewportChromeTarget();
      return null;
    }
    const { container } = render(
      <DemoViewport canonicalWidth={1280}>
        <Capture />
      </DemoViewport>,
    );

    const outer = container.firstElementChild as HTMLElement;
    const canvas = outer.firstElementChild as HTMLElement;
    expect(captured).not.toBeNull();
    // Chrome must escape the zoom: the layer is a wrapper child, never a
    // canvas descendant — otherwise portaled controls would scale after all.
    expect(outer.contains(captured)).toBe(true);
    expect(canvas.contains(captured)).toBe(false);
    // Covers the visual content box without intercepting content clicks.
    expect(captured!.className).toContain("absolute");
    expect(captured!.className).toContain("inset-0");
    expect(captured!.className).toContain("pointer-events-none");
  });

  it("provides no chrome target in the video-export passthrough", () => {
    const { getByTestId } = render(
      <VideoExportProvider>
        <DemoViewport canonicalWidth={1280}>
          <ChromeProbe />
        </DemoViewport>
      </VideoExportProvider>,
    );
    expect(getByTestId("probe").textContent).toBe("null");
  });
});
