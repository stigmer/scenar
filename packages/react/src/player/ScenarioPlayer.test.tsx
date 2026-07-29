import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import type { ScenarioStep } from "@scenar/core";
import { ScenarioPlayer } from "./ScenarioPlayer.js";
import { VideoExportProvider } from "../video/VideoExportContext.js";
import { DemoViewport } from "../viewport/DemoViewport.js";

// A long second step so the timeline never auto-advances mid-test.
const STEPS = [{ delayMs: 0 }, { delayMs: 60_000 }] as unknown as ScenarioStep<unknown>[];

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  // jsdom has no IntersectionObserver; the player's viewport auto-pause
  // observes the container outside video export.
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  // jsdom has no ResizeObserver either; DemoViewport (the chrome-layer
  // tests) observes its wrapper to compute zoom.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderPlayer() {
  return render(
    <ScenarioPlayer steps={STEPS}>{() => <div data-testid="content" />}</ScenarioPlayer>,
  );
}

const burstIn = (container: HTMLElement) =>
  container.querySelector("[data-playback-burst]")?.getAttribute("data-playback-burst") ?? null;

describe("ScenarioPlayer posterless idle", () => {
  it("covers the frame with nothing at idle — the control bar is the play affordance", () => {
    const { container } = renderPlayer();

    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("data-demo-state")).toBe("idle");
    // No poster, no center disc…
    expect(within(container).queryByRole("button", { name: /play demo/i })).toBeNull();
    expect(burstIn(container)).toBeNull();
    // …but the bar is already there, showing Play.
    expect(within(container).getByRole("button", { name: "Play" })).toBeDefined();
  });

  it("starts playback from a click anywhere on the content", () => {
    const { container } = renderPlayer();
    fireEvent.click(within(container).getByTestId("content"));

    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("data-demo-state")).toBe("playing");
    expect(burstIn(container)).toBe("play");
  });

  it("starts playback from the bar's play button, without a center burst", () => {
    const { container } = renderPlayer();
    fireEvent.click(within(container).getByRole("button", { name: "Play" }));

    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("data-demo-state")).toBe("playing");
    expect(burstIn(container)).toBeNull();
  });
});

describe("ScenarioPlayer playback burst", () => {
  it("bursts a pause glyph and leaves the frame clean when a content click pauses", () => {
    const { container } = renderPlayer();
    fireEvent.click(within(container).getByTestId("content"));

    fireEvent.click(within(container).getByTestId("content"));

    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("data-demo-state")).toBe("paused");
    expect(burstIn(container)).toBe("pause");
    // No persistent overlay while paused — the control bar carries the state.
    expect(within(container).queryByRole("button", { name: "Resume demo" })).toBeNull();
    expect(within(container).getByRole("button", { name: "Play" })).toBeDefined();
  });

  it("bursts a play glyph when a content click resumes playback", () => {
    const { container } = renderPlayer();
    fireEvent.click(within(container).getByTestId("content"));
    fireEvent.click(within(container).getByTestId("content"));

    fireEvent.click(within(container).getByTestId("content"));

    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("data-demo-state")).toBe("playing");
    expect(burstIn(container)).toBe("play");
  });

  it("never renders a burst during video export", () => {
    const { container } = render(
      <VideoExportProvider>
        <ScenarioPlayer steps={STEPS}>{() => <div data-testid="content" />}</ScenarioPlayer>
      </VideoExportProvider>,
    );

    // Export runs "playing" with no poster; a stray click must not paint
    // viewer chrome into exported frames.
    fireEvent.click(within(container).getByTestId("content"));
    expect(burstIn(container)).toBeNull();
  });
});

describe("ScenarioPlayer transport readout", () => {
  it("wires the readout into the control bar with the elapsed→remaining toggle", () => {
    const { container } = renderPlayer();

    const toggle = within(container).getByRole("button", { name: "Show remaining time" });
    fireEvent.click(toggle);
    expect(
      within(container).getByRole("button", { name: "Show elapsed time" }),
    ).toBeDefined();
  });
});

describe("ScenarioPlayer transport skips", () => {
  /** The readout's text, written by the progress loop / paused reposition. */
  function readout(container: HTMLElement): string {
    const toggle = within(container).getByRole("button", { name: /time$/ });
    return toggle.querySelector("span")!.textContent ?? "";
  }

  it("accumulates ±10s skips as absolute seeks from the current position", () => {
    const { container } = renderPlayer();
    // Enter paused so each seek's reposition (and readout write) is the
    // paused effect, not the RAF loop — deterministic under jsdom.
    fireEvent.click(within(container).getByTestId("content"));
    fireEvent.click(within(container).getByTestId("content"));
    expect(readout(container)).toMatch(/^0:00 \//);

    const forward = within(container).getByRole("button", { name: "Forward 10 seconds" });
    fireEvent.click(forward);
    expect(readout(container)).toMatch(/^0:10 \//);
    fireEvent.click(forward);
    expect(readout(container)).toMatch(/^0:20 \//);
  });

  it("clamps a skip past the start back to zero", () => {
    const { container } = renderPlayer();
    fireEvent.click(within(container).getByTestId("content"));
    fireEvent.click(within(container).getByTestId("content"));

    fireEvent.click(within(container).getByRole("button", { name: "Forward 10 seconds" }));
    fireEvent.click(within(container).getByRole("button", { name: "Back 10 seconds" }));
    fireEvent.click(within(container).getByRole("button", { name: "Back 10 seconds" }));
    expect(readout(container)).toMatch(/^0:00 \//);
  });
});

describe("ScenarioPlayer chrome layer", () => {
  it("portals the control bar into the DemoViewport chrome layer, outside the zoomed canvas", () => {
    const { container } = render(
      <DemoViewport canonicalWidth={1280}>
        <ScenarioPlayer steps={STEPS}>{() => <div data-testid="content" />}</ScenarioPlayer>
      </DemoViewport>,
    );

    const outer = container.firstElementChild as HTMLElement;
    const canvas = outer.firstElementChild as HTMLElement;
    const play = within(container).getByRole("button", { name: "Play" });

    // The recording scales (zoom + camera); the chrome must not: the bar
    // lives in the wrapper's unscaled overlay, the content in the canvas.
    expect(canvas.contains(play)).toBe(false);
    expect(outer.contains(play)).toBe(true);
    expect(canvas.contains(within(container).getByTestId("content"))).toBe(true);
  });

  it("seeds the readout after the bar re-portals onto the late-arriving chrome layer", () => {
    // The chrome target lands a commit after mount, replacing the bar's DOM
    // nodes AFTER the progress hook's one-time label write. Regression lock:
    // an idle player must not show a blank readout (caught visually in the
    // packed-tour check, 2026-07-29).
    const { container } = render(
      <DemoViewport canonicalWidth={1280}>
        <ScenarioPlayer steps={STEPS}>{() => <div data-testid="content" />}</ScenarioPlayer>
      </DemoViewport>,
    );

    const toggle = within(container).getByRole("button", { name: "Show remaining time" });
    expect(toggle.querySelector("span")!.textContent).toMatch(/^0:00 \//);
  });

  it("keeps the bar's clicks shielded from the content toggle across the portal", () => {
    const { container } = render(
      <DemoViewport canonicalWidth={1280}>
        <ScenarioPlayer steps={STEPS}>{() => <div data-testid="content" />}</ScenarioPlayer>
      </DemoViewport>,
    );

    // The bar's play button must start playback exactly once — a portal
    // bubbles through the React tree, so an unshielded click would ALSO hit
    // the content's click-to-toggle and immediately pause again.
    fireEvent.click(within(container).getByRole("button", { name: "Play" }));
    const root = container.querySelector("[data-demo-state]") as HTMLElement;
    expect(root.getAttribute("data-demo-state")).toBe("playing");
  });
});
