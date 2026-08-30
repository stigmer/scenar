import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, within } from "@testing-library/react";
import type { ScenarioStep } from "@scenar/core";
import { ScenarioPlayer } from "./ScenarioPlayer.js";
import { VideoExportProvider } from "../video/VideoExportContext.js";

const STEPS = [{ delayMs: 0 }, { delayMs: 100 }] as unknown as ScenarioStep<unknown>[];

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ScenarioPlayer in video export", () => {
  it("renders no poster/unlock affordance and runs the timeline directly", () => {
    // `embed` is set on purpose: even opted-in, the bridge stays inert because
    // export never runs inside a frame, and the poster (the only gesture that
    // calls narration unlock) is never shown under export.
    const postSpy = vi.spyOn(window, "postMessage");

    const { container } = render(
      <VideoExportProvider>
        <ScenarioPlayer steps={STEPS} embed>
          {() => <div data-testid="content" />}
        </ScenarioPlayer>
      </VideoExportProvider>,
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("data-demo-state")).not.toBe("idle");
    expect(within(container).queryByRole("button", { name: /play/i })).toBeNull();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it("renders no caption DOM in export without the captions prop", () => {
    const captionedSteps = [
      { delayMs: 0, narration: "Hello." },
    ] as unknown as ScenarioStep<unknown>[];

    const { container } = render(
      <VideoExportProvider>
        <ScenarioPlayer steps={captionedSteps}>
          {() => <div data-testid="content" />}
        </ScenarioPlayer>
      </VideoExportProvider>,
    );

    expect(container.querySelector("[data-scenar-captions]")).toBeNull();
  });

  it("burns the active step's caption at canonical subtitle size when captions is set", () => {
    // Export renders the overlay inline in the canonical content box (no
    // chrome layer), so it must use the canonical size variant — 1080p
    // subtitle type, not native-CSS-pixel embed sizing.
    const captionedSteps = [
      { delayMs: 0, narration: "Welcome to Acme Cloud." },
      { delayMs: 100 },
    ] as unknown as ScenarioStep<unknown>[];

    const { container } = render(
      <VideoExportProvider>
        <ScenarioPlayer steps={captionedSteps} captions>
          {() => <div data-testid="content" />}
        </ScenarioPlayer>
      </VideoExportProvider>,
    );

    const caption = container.querySelector("[data-scenar-captions]");
    expect(caption).not.toBeNull();
    expect(caption!.textContent).toBe("Welcome to Acme Cloud.");
    expect(caption!.innerHTML).toContain("text-[24px]");
    // hideControls is set under export, so no CC toggle can leak into frames.
    expect(within(container).queryByRole("button", { name: /captions/i })).toBeNull();
  });
});
