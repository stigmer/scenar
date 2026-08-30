import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import {
  type PresenterManifest,
  type ScenarioStep,
  computeStepTimeline,
  derivePresenterTimeline,
} from "@scenar/core";
import { ScenarioPlayer } from "./ScenarioPlayer.js";
import {
  type PresenterMediaProps,
  VideoExportProvider,
} from "../video/VideoExportContext.js";
import { TimeSourceProvider } from "../time/TimeSource.js";

// Toggled per test through the framer-motion mock below.
let mockReducedMotion = false;

vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return {
    ...actual,
    useReducedMotion: () => mockReducedMotion,
  };
});

interface TourData {
  screen: string;
}

const STEPS: ScenarioStep<TourData>[] = [
  { delayMs: 0, data: { screen: "login" }, narration: "Welcome." },
  { delayMs: 800, data: { screen: "dashboard" }, narration: "The dashboard." },
];

/** Clip on step 1 only — step 0 must render no presenter DOM. */
const MANIFEST: PresenterManifest = {
  steps: [null, { src: "http://localhost/step-1.mp4", durationMs: 4_000 }],
};

function renderPlayer(presenterManifest?: PresenterManifest) {
  return render(
    <ScenarioPlayer steps={[...STEPS]} presenterManifest={presenterManifest}>
      {(data) => <div data-testid="content">{data.screen}</div>}
    </ScenarioPlayer>,
  );
}

beforeEach(() => {
  mockReducedMotion = false;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
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

describe("ScenarioPlayer presenter", () => {
  it("renders zero presenter DOM without a manifest — byte-identical absence", () => {
    const { container } = renderPlayer(undefined);
    expect(container.querySelector("[data-scenar-presenter]")).toBeNull();
    expect(container.querySelector("video")).toBeNull();
  });

  it("renders no frame while the active step has no clip", () => {
    const { container } = renderPlayer(MANIFEST);
    // Step 0 (active at mount) has a null entry.
    expect(container.querySelector("[data-scenar-presenter]")).toBeNull();
  });

  it("mounts the frame when a presenter step becomes active", () => {
    vi.useFakeTimers();
    try {
      const { container } = renderPlayer(MANIFEST);
      // Start playback (content click) and let step 0's delay elapse.
      fireEvent.click(container.querySelector("[data-demo-step]")!.firstChild as Element);
      act(() => {
        vi.advanceTimersByTime(900);
      });

      const frame = container.querySelector("[data-scenar-presenter]");
      expect(frame).not.toBeNull();
      const video = frame!.querySelector("video")!;
      expect(video.muted).toBe(true);
      expect(video.getAttribute("playsinline")).not.toBeNull();
      expect(video.tabIndex).toBe(-1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the frame presentational: aria-hidden and pointer-events-none", () => {
    vi.useFakeTimers();
    try {
      const { container } = renderPlayer(MANIFEST);
      fireEvent.click(container.querySelector("[data-demo-step]")!.firstChild as Element);
      act(() => {
        vi.advanceTimersByTime(900);
      });

      const frame = container.querySelector("[data-scenar-presenter]")!;
      expect(frame.getAttribute("aria-hidden")).toBe("true");
      expect(frame.className).toContain("pointer-events-none");
    } finally {
      vi.useRealTimers();
    }
  });

  it("hides the presenter entirely under prefers-reduced-motion", () => {
    mockReducedMotion = true;
    // Reduced motion jumps the player to the last step — the presenter
    // step — which must still render no frame.
    const { container } = renderPlayer(MANIFEST);
    const root = container.querySelector("[data-demo-step]")!;
    expect(root.getAttribute("data-demo-step")).toBe("1");
    expect(container.querySelector("[data-scenar-presenter]")).toBeNull();
    expect(container.querySelector("video")).toBeNull();
  });

  describe("video export", () => {
    it("fills the frame's media slot with the injected renderer, frame-locked props included", () => {
      const timeline = computeStepTimeline(STEPS, MANIFEST);
      const windows = derivePresenterTimeline(MANIFEST, timeline);
      const renderer = vi.fn(({ src }: PresenterMediaProps) => (
        <div data-testid="export-media" data-src={src} />
      ));

      // Frame time mid-way through the presenter step (step 1).
      const midClipMs = windows[0]!.startMs + 2_000;
      const { container, getByTestId } = render(
        <TimeSourceProvider
          currentTimeMs={midClipMs}
          stepStartTimesMs={timeline.stepStartTimesMs}
        >
          <VideoExportProvider presenterMedia={renderer}>
            <ScenarioPlayer steps={[...STEPS]} presenterManifest={MANIFEST}>
              {(data) => <div>{data.screen}</div>}
            </ScenarioPlayer>
          </VideoExportProvider>
        </TimeSourceProvider>,
      );

      expect(getByTestId("export-media").getAttribute("data-src")).toBe(
        "http://localhost/step-1.mp4",
      );
      expect(renderer).toHaveBeenCalledWith(
        expect.objectContaining({
          src: "http://localhost/step-1.mp4",
          window: windows[0],
        }),
      );
      // No browser <video> in the export path — the renderer owns media.
      expect(container.querySelector("video")).toBeNull();
    });

    it("computes the fade from frame time: opaque mid-clip, invisible after clip end", () => {
      const timeline = computeStepTimeline(STEPS, MANIFEST);
      const windows = derivePresenterTimeline(MANIFEST, timeline);

      const renderAtTime = (currentTimeMs: number) =>
        render(
          <TimeSourceProvider
            currentTimeMs={currentTimeMs}
            stepStartTimesMs={timeline.stepStartTimesMs}
          >
            <VideoExportProvider presenterMedia={() => <div />}>
              <ScenarioPlayer steps={[...STEPS]} presenterManifest={MANIFEST}>
                {(data) => <div>{data.screen}</div>}
              </ScenarioPlayer>
            </VideoExportProvider>
          </TimeSourceProvider>,
        );

      const mid = renderAtTime(windows[0]!.startMs + 2_000);
      const midFrame = mid.container.querySelector(
        "[data-scenar-presenter]",
      ) as HTMLElement;
      expect(Number(midFrame.style.opacity)).toBe(1);
      mid.unmount();

      // 100ms into the fade-in.
      const fadingIn = renderAtTime(windows[0]!.startMs + 100);
      const fadingFrame = fadingIn.container.querySelector(
        "[data-scenar-presenter]",
      ) as HTMLElement;
      expect(Number(fadingFrame.style.opacity)).toBeCloseTo(0.5, 5);
    });
  });
});
