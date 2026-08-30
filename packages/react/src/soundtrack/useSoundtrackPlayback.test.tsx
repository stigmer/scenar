import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import type { ScenarioStep, Soundtrack } from "@scenar/core";
import { ScenarioPlayer } from "../player/ScenarioPlayer.js";
import { VideoExportProvider } from "../video/VideoExportContext.js";
import { TimeSourceProvider } from "../time/TimeSource.js";

// A long second step so the timeline never auto-advances mid-test. The
// first step carries a click and a type interaction whose derived SFX
// times are: click at 450 (CLICK_DELAY_MS), keystrokes at 450 and 500.
const STEPS = [
  {
    delayMs: 0,
    interactions: [
      { atPercent: 0, type: "click", target: "btn" },
      { atPercent: 0, type: "type", target: "input", text: "ab" },
    ],
  },
  { delayMs: 60_000 },
] as unknown as ScenarioStep<unknown>[];

const MUSIC_SOUNDTRACK: Soundtrack = { musicSrc: "./soundtrack/music.mp3" };
const SFX_SOUNDTRACK: Soundtrack = { sfx: true };
const SFX_SOURCES = {
  sfx: { click: "/sfx/click.mp3", keystroke: "/sfx/keystroke.mp3" },
};

/** Buffer-source nodes created across every mock context instance. */
let startedSfxNodes: Array<{ start: ReturnType<typeof vi.fn> }>;
let createdContexts: MockAudioContext[];

class MockAudioContext {
  state = "running";
  destination = {};
  gainNodes: Array<{ gain: { value: number } }> = [];

  constructor() {
    createdContexts.push(this);
  }
  createMediaElementSource = vi.fn(() => ({ connect: vi.fn() }));
  createGain = vi.fn(() => {
    const node = { connect: vi.fn(), gain: { value: 1 } };
    this.gainNodes.push(node);
    return node;
  });
  createBufferSource = vi.fn(() => {
    const node = { buffer: null, connect: vi.fn(), start: vi.fn() };
    startedSfxNodes.push(node);
    return node;
  });
  decodeAudioData = vi.fn(async () => ({}) as AudioBuffer);
  resume = vi.fn(async () => {});
  close = vi.fn(async () => {});
}

beforeEach(() => {
  startedSfxNodes = [];
  createdContexts = [];
  vi.stubGlobal("AudioContext", MockAudioContext);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(8) }),
  );
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
  vi.useRealTimers();
});

function renderPlayer(soundtrack?: Soundtrack, sources?: typeof SFX_SOURCES) {
  return render(
    <ScenarioPlayer steps={STEPS} soundtrack={soundtrack} soundtrackSources={sources}>
      {() => <div data-testid="content" />}
    </ScenarioPlayer>,
  );
}

describe("ScenarioPlayer soundtrack wiring", () => {
  it("renders no audio element and creates no AudioContext without a soundtrack", () => {
    const { container } = renderPlayer();
    expect(container.querySelectorAll("audio")).toHaveLength(0);
    expect(createdContexts).toHaveLength(0);
  });

  it("renders a looping music element when the soundtrack has music", () => {
    const { container } = renderPlayer(MUSIC_SOUNDTRACK);
    const audio = container.querySelectorAll("audio");
    expect(audio).toHaveLength(1);
    expect(audio[0]!.loop).toBe(true);
  });

  it("starts music inside the play gesture with the resolved source", () => {
    const { container } = renderPlayer(MUSIC_SOUNDTRACK);
    fireEvent.click(within(container).getByTestId("content"));

    const music = container.querySelector("audio")!;
    expect(music.getAttribute("src")).toBe("./soundtrack/music.mp3");
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });

  it("routes music through a gain node set from the envelope (0 at the fade-in start)", () => {
    const { container } = renderPlayer(MUSIC_SOUNDTRACK);
    fireEvent.click(within(container).getByTestId("content"));

    expect(createdContexts).toHaveLength(1);
    const gains = createdContexts[0]!.gainNodes;
    expect(gains).toHaveLength(1);
    // At timeline t=0 the 1s fade-in holds the level at 0.
    expect(gains[0]!.gain.value).toBe(0);
  });

  it("prefers an explicit music source override", () => {
    const { container } = render(
      <ScenarioPlayer
        steps={STEPS}
        soundtrack={MUSIC_SOUNDTRACK}
        soundtrackSources={{ music: "https://cdn.example.com/music.mp3" }}
      >
        {() => <div data-testid="content" />}
      </ScenarioPlayer>,
    );
    fireEvent.click(within(container).getByTestId("content"));
    expect(container.querySelector("audio")!.getAttribute("src")).toBe(
      "https://cdn.example.com/music.mp3",
    );
  });

  it("is fully inert under video export: no element, no AudioContext", () => {
    const { container } = render(
      <TimeSourceProvider currentTimeMs={0} stepStartTimesMs={[0, 60_000]}>
        <VideoExportProvider>
          <ScenarioPlayer steps={STEPS} soundtrack={MUSIC_SOUNDTRACK}>
            {() => <div data-testid="content" />}
          </ScenarioPlayer>
        </VideoExportProvider>
      </TimeSourceProvider>,
    );
    expect(container.querySelectorAll("audio")).toHaveLength(0);
    expect(createdContexts).toHaveLength(0);
  });
});

describe("ScenarioPlayer SFX playback", () => {
  it("plays the derived sounds at their scheduled moments", async () => {
    vi.useFakeTimers();
    const { container } = renderPlayer(SFX_SOUNDTRACK, SFX_SOURCES);
    fireEvent.click(within(container).getByTestId("content"));

    expect(fetch).toHaveBeenCalledWith("/sfx/click.mp3");
    expect(fetch).toHaveBeenCalledWith("/sfx/keystroke.mp3");

    // Before the click-dispatch moment (450ms): silence.
    await vi.advanceTimersByTimeAsync(400);
    expect(startedSfxNodes).toHaveLength(0);

    // Click at 450, keystrokes at 450 and 500.
    await vi.advanceTimersByTimeAsync(200);
    expect(startedSfxNodes).toHaveLength(3);
    for (const node of startedSfxNodes) {
      expect(node.start).toHaveBeenCalledTimes(1);
    }
  });

  it("plays nothing while the player is idle", async () => {
    vi.useFakeTimers();
    renderPlayer(SFX_SOUNDTRACK, SFX_SOURCES);

    await vi.advanceTimersByTimeAsync(1000);
    expect(startedSfxNodes).toHaveLength(0);
  });

  it("plays nothing after the viewer mutes", async () => {
    vi.useFakeTimers();
    const { container } = renderPlayer(SFX_SOUNDTRACK, SFX_SOURCES);
    fireEvent.click(within(container).getByTestId("content"));
    fireEvent.click(within(container).getByRole("button", { name: "Mute audio" }));

    await vi.advanceTimersByTimeAsync(1000);
    expect(startedSfxNodes).toHaveLength(0);
  });

  it("music alone schedules no sound effects (sfx requires explicit true)", async () => {
    vi.useFakeTimers();
    const { container } = renderPlayer(MUSIC_SOUNDTRACK, SFX_SOURCES);
    fireEvent.click(within(container).getByTestId("content"));

    await vi.advanceTimersByTimeAsync(1000);
    expect(startedSfxNodes).toHaveLength(0);
    // Nothing was fetched either — the SFX pipeline never started.
    expect(fetch).not.toHaveBeenCalledWith("/sfx/click.mp3");
  });
});
