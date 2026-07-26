import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { DemoViewport } from "./DemoViewport.js";

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
