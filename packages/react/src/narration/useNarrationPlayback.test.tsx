import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import type { NarrationManifest } from "@scenar/core";
import { useNarrationPlayback } from "./useNarrationPlayback.js";

// jsdom does not implement HTMLMediaElement playback; stub the surface the hook
// touches so we can assert when/whether play() is invoked.
let api!: ReturnType<typeof useNarrationPlayback>;

function Harness(props: { manifest?: NarrationManifest; playing?: boolean; initialMuted?: boolean }) {
  api = useNarrationPlayback({
    manifest: props.manifest,
    stepIndex: 0,
    playing: props.playing ?? false,
    initialMuted: props.initialMuted ?? false,
  });
  return <audio ref={api.audioRef} />;
}

const MANIFEST: NarrationManifest = { steps: [{ src: "/step-0.mp3", durationMs: 1000 }] };

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useNarrationPlayback", () => {
  it("unlock() starts playback synchronously inside the gesture", () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    render(<Harness manifest={MANIFEST} initialMuted={false} />);

    // Not playing on mount (playing=false) — only the gesture starts audio.
    expect(play).not.toHaveBeenCalled();

    act(() => {
      api.unlock();
    });

    expect(play).toHaveBeenCalledTimes(1);
  });

  it("flags audioBlocked when the browser rejects play()", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(
      new DOMException("blocked", "NotAllowedError"),
    );
    render(<Harness manifest={MANIFEST} initialMuted={false} />);

    act(() => {
      api.unlock();
    });

    await waitFor(() => expect(api.audioBlocked).toBe(true));
  });

  it("does not start audio when muted", () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    render(<Harness manifest={MANIFEST} initialMuted={true} />);

    act(() => {
      api.unlock();
    });

    expect(play).not.toHaveBeenCalled();
  });

  it("clamps volume into [0, 1]", () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    render(<Harness manifest={MANIFEST} />);

    act(() => api.setVolume(0.5));
    expect(api.audioRef.current?.volume).toBe(0.5);

    act(() => api.setVolume(2));
    expect(api.audioRef.current?.volume).toBe(1);

    act(() => api.setVolume(-1));
    expect(api.audioRef.current?.volume).toBe(0);
  });

  it("stops audio on unmount", () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause");
    const { unmount } = render(<Harness manifest={MANIFEST} />);

    pause.mockClear();
    unmount();

    expect(pause).toHaveBeenCalled();
  });
});
