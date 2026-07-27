import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import type { ScenarioStep } from "@scenar/core";
import { ScenarioPlayer } from "./ScenarioPlayer.js";
import { VideoExportProvider } from "../video/VideoExportContext.js";

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

describe("ScenarioPlayer playback burst", () => {
  it("shows no burst for the poster's initial play (the poster's exit is the feedback)", () => {
    const { container } = renderPlayer();
    fireEvent.click(within(container).getByRole("button", { name: "Play demo" }));

    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("data-demo-state")).toBe("playing");
    expect(burstIn(container)).toBeNull();
  });

  it("bursts a pause glyph and leaves the frame clean when a content click pauses", () => {
    const { container } = renderPlayer();
    fireEvent.click(within(container).getByRole("button", { name: "Play demo" }));

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
    fireEvent.click(within(container).getByRole("button", { name: "Play demo" }));
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
    fireEvent.click(within(container).getByRole("button", { name: "Play demo" }));

    const toggle = within(container).getByRole("button", { name: "Show remaining time" });
    fireEvent.click(toggle);
    expect(
      within(container).getByRole("button", { name: "Show elapsed time" }),
    ).toBeDefined();
  });
});
