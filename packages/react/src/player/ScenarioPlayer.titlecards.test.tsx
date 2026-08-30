import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { type ScenarioStep, applyTitleCards } from "@scenar/core";
import { ScenarioPlayer } from "./ScenarioPlayer.js";
import { VideoExportProvider } from "../video/VideoExportContext.js";
import { TimeSourceProvider } from "../time/TimeSource.js";

interface TourData {
  screen: string;
}

const AUTHORED: ScenarioStep<TourData>[] = [
  { delayMs: 0, data: { screen: "login" } },
  { delayMs: 1500, data: { screen: "dashboard" } },
];

/** The real synthesis output — the same expansion bundle assembly performs. */
const FRAMED = applyTitleCards(AUTHORED, undefined, {
  intro: {
    title: "Acme Deploy",
    subtitle: "Ship in seconds",
    logoSrc: "./logo.png",
  },
  outro: { title: "Try it today", ctaText: "acme.dev/start" },
});

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

describe("ScenarioPlayer title cards", () => {
  it("renders the intro card itself and never calls the render function for it", () => {
    const renderFn = vi.fn(() => <div data-testid="content" />);

    const { container } = render(
      <ScenarioPlayer steps={[...FRAMED.steps]}>{renderFn}</ScenarioPlayer>,
    );

    const card = container.querySelector("[data-scenar-card]");
    expect(card).not.toBeNull();
    expect(card!.getAttribute("data-scenar-card")).toBe("intro");
    expect(renderFn).not.toHaveBeenCalled();
  });

  it("renders the card's logo, title, and subtitle", () => {
    const { container } = render(
      <ScenarioPlayer steps={[...FRAMED.steps]}>{() => null}</ScenarioPlayer>,
    );

    const card = container.querySelector("[data-scenar-card]")!;
    expect(card.textContent).toContain("Acme Deploy");
    expect(card.textContent).toContain("Ship in seconds");
    expect(card.querySelector("img")!.getAttribute("src")).toBe("./logo.png");
  });

  it("does not fire onStepChange for a card step", () => {
    const onStepChange = vi.fn();

    render(
      <ScenarioPlayer steps={[...FRAMED.steps]} onStepChange={onStepChange}>
        {() => null}
      </ScenarioPlayer>,
    );

    // The intro card is the mounted step; the callback must stay silent —
    // its `data` is an engine placeholder, not the integrator's `T`.
    expect(onStepChange).not.toHaveBeenCalled();
  });

  it("fires onStepChange for an authored first step, unchanged", () => {
    const onStepChange = vi.fn();

    render(
      <ScenarioPlayer steps={AUTHORED} onStepChange={onStepChange}>
        {() => null}
      </ScenarioPlayer>,
    );

    expect(onStepChange).toHaveBeenCalledWith({ screen: "login" }, 0);
  });

  it("still renders the control bar over a card step", () => {
    const { container } = render(
      <ScenarioPlayer steps={[...FRAMED.steps]}>{() => null}</ScenarioPlayer>,
    );

    expect(container.querySelector("[data-scenar-card]")).not.toBeNull();
    expect(container.querySelector("[data-demo-step]")).not.toBeNull();
    expect(container.querySelectorAll("button").length).toBeGreaterThan(0);
  });

  describe("in video export (frame-driven time)", () => {
    const startTimes = [0, 3000, 6000, 9000];

    function renderAtTime(currentTimeMs: number) {
      const renderFn = vi.fn((data: TourData) => (
        <div data-testid="content">{data.screen}</div>
      ));
      const result = render(
        <TimeSourceProvider
          currentTimeMs={currentTimeMs}
          stepStartTimesMs={startTimes}
        >
          <VideoExportProvider>
            <ScenarioPlayer steps={[...FRAMED.steps]}>{renderFn}</ScenarioPlayer>
          </VideoExportProvider>
        </TimeSourceProvider>,
      );
      return { ...result, renderFn };
    }

    it("shows the intro card at time zero", () => {
      const { container, renderFn } = renderAtTime(0);
      expect(container.querySelector("[data-scenar-card='intro']")).not.toBeNull();
      expect(renderFn).not.toHaveBeenCalled();
    });

    it("hands authored steps to the render function with their expanded index", () => {
      const { container, renderFn } = renderAtTime(4000);
      expect(container.querySelector("[data-scenar-card]")).toBeNull();
      expect(renderFn).toHaveBeenCalledWith({ screen: "login" }, 1);
    });

    it("shows the outro card, CTA included, at the closing dwell", () => {
      const { container } = renderAtTime(9500);
      const card = container.querySelector("[data-scenar-card='outro']");
      expect(card).not.toBeNull();
      expect(card!.textContent).toContain("Try it today");
      expect(card!.textContent).toContain("acme.dev/start");
    });
  });
});
