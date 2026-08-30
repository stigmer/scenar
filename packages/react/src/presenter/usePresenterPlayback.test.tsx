import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { type PresenterManifest, computeStepTimeline } from "@scenar/core";
import { usePresenterPlayback } from "./usePresenterPlayback.js";

// jsdom does not implement HTMLMediaElement playback; stub the surface the
// hook touches so tests can assert when/whether play(), load(), and the
// snap-seeks (currentTime writes) happen.

const STEPS = [{ delayMs: 0 }, { delayMs: 1_000 }];
const TIMELINE = computeStepTimeline(STEPS, null);

const MANIFEST: PresenterManifest = {
  steps: [
    { src: "http://localhost/step-0.mp4", durationMs: 5_000 },
    null,
  ],
};

interface HarnessProps {
  manifest?: PresenterManifest;
  stepIndex?: number;
  playing?: boolean;
  idle?: boolean;
  muted?: boolean;
  playbackRate?: number;
  enabled?: boolean;
  currentTimeMs?: number;
}

let api!: ReturnType<typeof usePresenterPlayback>;
// The scenario clock the hook reads while muted (and for the fade).
const currentTimeMsRef = { current: 0 };
const audioRef = { current: null as HTMLAudioElement | null };

function Harness({
  manifest = MANIFEST,
  stepIndex = 0,
  playing = false,
  idle = false,
  muted = true,
  playbackRate = 1,
  enabled = true,
  currentTimeMs,
}: HarnessProps) {
  if (currentTimeMs !== undefined) currentTimeMsRef.current = currentTimeMs;
  api = usePresenterPlayback({
    manifest,
    stepIndex,
    playing,
    idle,
    muted,
    playbackRate,
    audioRef,
    currentTimeMsRef,
    stepTimeline: TIMELINE,
    enabled,
  });
  return (
    <div ref={api.frameRef} data-frame="">
      <video ref={api.videoRef} muted playsInline />
    </div>
  );
}

function video(): HTMLVideoElement {
  return api.videoRef.current!;
}

beforeEach(() => {
  vi.useFakeTimers();
  currentTimeMsRef.current = 0;
  audioRef.current = null;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  // seekToStep's metadata gate: report metadata as already available.
  vi.spyOn(HTMLMediaElement.prototype, "readyState", "get").mockReturnValue(
    HTMLMediaElement.HAVE_METADATA,
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("usePresenterPlayback", () => {
  it("loads nothing while idle — an unplayed embed fetches zero presenter bytes", () => {
    render(<Harness idle playing={false} />);
    expect(video().getAttribute("src")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("swaps in the active step's clip once playback starts", () => {
    const { rerender } = render(<Harness idle playing={false} />);
    rerender(<Harness idle={false} playing />);

    expect(video().src).toBe("http://localhost/step-0.mp4");
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });

  it("warms the remaining clips over HTTP on first play", () => {
    const { rerender } = render(<Harness idle playing={false} />);
    expect(fetch).not.toHaveBeenCalled();

    rerender(<Harness idle={false} playing />);
    expect(fetch).toHaveBeenCalledWith("http://localhost/step-0.mp4");
  });

  it("stops the element on a step without a clip", () => {
    const { rerender } = render(<Harness playing />);
    expect(video().src).toBe("http://localhost/step-0.mp4");

    rerender(<Harness playing stepIndex={1} />);
    expect(video().getAttribute("src")).toBeNull();
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  it("snaps to the muted sync clock on resume (the pause/resume gap correction)", () => {
    const { rerender } = render(<Harness playing currentTimeMs={0} />);

    rerender(<Harness playing={false} currentTimeMs={3_000} />);
    rerender(<Harness playing currentTimeMs={3_000} />);

    // Muted clock: intra-step scenario time = 3000ms into step 0.
    expect(video().currentTime).toBe(3);
  });

  it("aligns to the narration element's clock while unmuted", () => {
    const audio = document.createElement("audio");
    Object.defineProperty(audio, "src", { value: "http://localhost/step-0.mp3" });
    Object.defineProperty(audio, "currentTime", { value: 2.5 });
    audioRef.current = audio;

    const { rerender } = render(<Harness muted={false} playing={false} />);
    rerender(<Harness muted={false} playing />);

    expect(video().currentTime).toBe(2.5);
  });

  it("snaps when the 1s safety check finds drift beyond the budget", () => {
    render(<Harness playing currentTimeMs={3_000} />);
    video().currentTime = 2.5; // 500ms behind — way over the 50ms budget

    act(() => vi.advanceTimersByTime(1_000));
    expect(video().currentTime).toBe(3);
  });

  it("leaves sub-budget drift alone (no correction churn at the noise floor)", () => {
    render(<Harness playing currentTimeMs={3_000} />);
    video().currentTime = 2.98; // 20ms — inside the 50ms budget

    act(() => vi.advanceTimersByTime(1_000));
    expect(video().currentTime).toBe(2.98);
  });

  it("applies rate changes to the element and snaps", () => {
    const { rerender } = render(<Harness playing currentTimeMs={1_000} />);
    rerender(<Harness playing playbackRate={2} currentTimeMs={1_000} />);

    expect(video().playbackRate).toBe(2);
    expect(video().currentTime).toBe(1);
  });

  it("re-aligns and resumes on return from a hidden tab", () => {
    render(<Harness playing currentTimeMs={4_000} />);
    video().currentTime = 1; // the browser paused the hidden video
    (HTMLMediaElement.prototype.play as ReturnType<typeof vi.fn>).mockClear();

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(video().currentTime).toBe(4);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });

  it("drives the fade opacity from the shared pure function while playing", () => {
    const { container } = render(<Harness playing currentTimeMs={100} />);

    act(() => vi.advanceTimersByTime(32)); // let a rAF tick fire
    const frame = container.querySelector("[data-frame]") as HTMLElement;
    // 100ms into the 200ms fade-in.
    expect(Number(frame.style.opacity)).toBeCloseTo(0.5, 5);
  });

  describe("seekToStep", () => {
    it("positions the clip at the seek offset and writes its fade opacity", () => {
      const { container } = render(<Harness playing />);

      act(() => api.seekToStep(0, 2_500));

      expect(video().currentTime).toBe(2.5);
      const frame = container.querySelector("[data-frame]") as HTMLElement;
      expect(Number(frame.style.opacity)).toBe(1); // mid-clip, fully visible
    });

    it("stops the element when seeking to a step without a clip", () => {
      const { container } = render(<Harness playing />);

      act(() => api.seekToStep(1, 200));

      expect(video().getAttribute("src")).toBeNull();
      const frame = container.querySelector("[data-frame]") as HTMLElement;
      expect(frame.style.opacity).toBe("0");
    });
  });

  it("does nothing when disabled (export mode / reduced motion)", () => {
    render(<Harness enabled={false} playing />);
    expect(video().getAttribute("src")).toBeNull();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();

    act(() => api.seekToStep(0, 1_000));
    expect(video().getAttribute("src")).toBeNull();
  });

  it("releases the element on unmount", () => {
    const { unmount } = render(<Harness playing />);
    (HTMLMediaElement.prototype.pause as ReturnType<typeof vi.fn>).mockClear();

    unmount();
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();

    // The safety interval died with the effect cleanup — advancing time
    // after unmount must not touch the detached element.
    expect(() => vi.advanceTimersByTime(5_000)).not.toThrow();
  });
});
