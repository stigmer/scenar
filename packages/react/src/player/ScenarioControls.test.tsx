import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import type { StepTimeline } from "@scenar/core";
import { ScenarioControls } from "./ScenarioControls.js";

afterEach(cleanup);

const TIMELINE: StepTimeline = {
  stepStartTimesMs: [0, 4_000],
  totalDurationMs: 8_000,
};

function renderControls(overrides: Partial<Parameters<typeof ScenarioControls>[0]> = {}) {
  const props = {
    visible: true,
    playing: true,
    muted: false,
    playbackRate: 1,
    stepTimeline: TIMELINE,
    showSpeedControl: true,
    hasNarration: true,
    progressTrackRef: createRef<HTMLDivElement>(),
    playheadRef: createRef<HTMLDivElement>(),
    onTogglePlay: vi.fn(),
    onToggleMute: vi.fn(),
    onSelectSpeed: vi.fn(),
    onSeekToTime: vi.fn(),
    ...overrides,
  };
  const view = render(<ScenarioControls {...props} />);
  return { props, ...view };
}

/**
 * jsdom implements neither pointer capture nor layout. Stub capture with a
 * stateful mock (so capture-gated move/up handlers behave like a browser)
 * and give the progress bar a 100px-wide rect so clientX maps 1:1 to
 * percentage.
 */
beforeEach(() => {
  let captured = false;
  Element.prototype.setPointerCapture = vi.fn(() => {
    captured = true;
  });
  Element.prototype.releasePointerCapture = vi.fn(() => {
    captured = false;
  });
  Element.prototype.hasPointerCapture = vi.fn(() => captured);
});

function stubBarRect(bar: HTMLElement) {
  vi.spyOn(bar, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 100,
    bottom: 8,
    width: 100,
    height: 8,
    toJSON: () => ({}),
  } as DOMRect);
}

describe("ScenarioControls transport buttons", () => {
  it("labels play/pause from the playing state", () => {
    const { container, rerender, props } = renderControls({ playing: true });
    expect(within(container).getByRole("button", { name: "Pause" })).toBeDefined();

    rerender(<ScenarioControls {...props} playing={false} />);
    expect(within(container).getByRole("button", { name: "Play" })).toBeDefined();
  });

  it("keeps mute and fullscreen operable and labeled", () => {
    const onToggleMute = vi.fn();
    const onToggleFullscreen = vi.fn();
    const { container } = renderControls({ muted: true, onToggleMute, onToggleFullscreen });

    fireEvent.click(within(container).getByRole("button", { name: "Unmute narration" }));
    expect(onToggleMute).toHaveBeenCalledTimes(1);

    fireEvent.click(within(container).getByRole("button", { name: "Enter fullscreen" }));
    expect(onToggleFullscreen).toHaveBeenCalledTimes(1);
  });

  it("always shows the volume control, disabled when the tour has no narration", () => {
    const onToggleMute = vi.fn();
    const { container } = renderControls({ hasNarration: false, onToggleMute });

    const volume = within(container).getByRole("button", { name: "No narration audio" });
    expect(volume).toHaveProperty("disabled", true);
    fireEvent.click(volume);
    expect(onToggleMute).not.toHaveBeenCalled();
  });

  it("stops clicks from reaching the content (which toggles play on click)", () => {
    const contentClick = vi.fn();
    const props = {
      visible: true,
      playing: true,
      muted: false,
      playbackRate: 1,
      stepTimeline: TIMELINE,
      showSpeedControl: false,
      hasNarration: false,
      progressTrackRef: createRef<HTMLDivElement>(),
      playheadRef: createRef<HTMLDivElement>(),
      onTogglePlay: vi.fn(),
      onToggleMute: vi.fn(),
      onSelectSpeed: vi.fn(),
      onSeekToTime: vi.fn(),
    };
    const { container } = render(
      <div onClick={contentClick}>
        <ScenarioControls {...props} />
      </div>,
    );

    fireEvent.click(within(container).getByRole("button", { name: "Pause" }));
    fireEvent.click(within(container).getByRole("progressbar"));
    expect(contentClick).not.toHaveBeenCalled();
    expect(props.onTogglePlay).toHaveBeenCalledTimes(1);
  });
});

describe("ScenarioControls skip buttons", () => {
  it("renders the ±10s skips only when a skip handler is provided", () => {
    const { container } = renderControls();
    expect(within(container).queryByRole("button", { name: "Back 10 seconds" })).toBeNull();
    expect(within(container).queryByRole("button", { name: "Forward 10 seconds" })).toBeNull();

    const { container: withSkips } = renderControls({ onSkip: vi.fn() });
    expect(within(withSkips).getByRole("button", { name: "Back 10 seconds" })).toBeDefined();
    expect(within(withSkips).getByRole("button", { name: "Forward 10 seconds" })).toBeDefined();
  });

  it("skips by a signed 10-second delta", () => {
    const onSkip = vi.fn();
    const { container } = renderControls({ onSkip });

    fireEvent.click(within(container).getByRole("button", { name: "Back 10 seconds" }));
    expect(onSkip).toHaveBeenCalledWith(-10_000);

    fireEvent.click(within(container).getByRole("button", { name: "Forward 10 seconds" }));
    expect(onSkip).toHaveBeenCalledWith(10_000);
    expect(onSkip).toHaveBeenCalledTimes(2);
  });

  it("stops skip clicks from reaching the content's play/pause toggle", () => {
    const contentClick = vi.fn();
    const onSkip = vi.fn();
    const { container } = render(
      <div onClick={contentClick}>
        <ScenarioControls
          visible
          playing
          muted={false}
          playbackRate={1}
          stepTimeline={TIMELINE}
          showSpeedControl={false}
          hasNarration={false}
          progressTrackRef={createRef<HTMLDivElement>()}
          playheadRef={createRef<HTMLDivElement>()}
          onTogglePlay={vi.fn()}
          onToggleMute={vi.fn()}
          onSelectSpeed={vi.fn()}
          onSeekToTime={vi.fn()}
          onSkip={onSkip}
        />
      </div>,
    );

    fireEvent.click(within(container).getByRole("button", { name: "Forward 10 seconds" }));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(contentClick).not.toHaveBeenCalled();
  });
});

describe("ScenarioControls time readout", () => {
  it("renders the readout only when a label ref is provided", () => {
    const { container } = renderControls();
    expect(
      within(container).queryByRole("button", { name: /remaining time/i }),
    ).toBeNull();

    const { container: withTimer } = renderControls({
      timeLabelRef: createRef<HTMLSpanElement>(),
    });
    expect(
      within(withTimer).getByRole("button", { name: "Show remaining time" }),
    ).toBeDefined();
  });

  it("toggles the display mode on click and relabels for the other direction", () => {
    const onToggleTimeDisplay = vi.fn();
    const timeLabelRef = createRef<HTMLSpanElement>();
    const { container, rerender, props } = renderControls({
      timeLabelRef,
      timeDisplayMode: "elapsed",
      onToggleTimeDisplay,
    });

    fireEvent.click(within(container).getByRole("button", { name: "Show remaining time" }));
    expect(onToggleTimeDisplay).toHaveBeenCalledTimes(1);

    rerender(
      <ScenarioControls {...props} timeLabelRef={timeLabelRef} timeDisplayMode="remaining" />,
    );
    expect(
      within(container).getByRole("button", { name: "Show elapsed time" }),
    ).toBeDefined();
  });

  it("renders the label element childless so the progress loop owns its text", () => {
    const timeLabelRef = createRef<HTMLSpanElement>();
    renderControls({ timeLabelRef });
    expect(timeLabelRef.current).not.toBeNull();
    expect(timeLabelRef.current!.textContent).toBe("");
  });
});

describe("ScenarioControls seeking", () => {
  it("commits a click as a zero-distance drag at the clicked fraction", () => {
    const onSeekToTime = vi.fn();
    const { container } = renderControls({ onSeekToTime });
    const bar = within(container).getByRole("progressbar");
    stubBarRect(bar);

    fireEvent.pointerDown(bar, { pointerId: 1, clientX: 25 });
    fireEvent.pointerUp(bar, { pointerId: 1, clientX: 25 });

    expect(onSeekToTime).toHaveBeenCalledTimes(1);
    expect(onSeekToTime).toHaveBeenCalledWith(0.25 * TIMELINE.totalDurationMs);
  });

  it("previews during a drag and commits once, on release, at the final position", () => {
    const onSeekToTime = vi.fn();
    const progressTrackRef = createRef<HTMLDivElement>();
    const timeLabelRef = createRef<HTMLSpanElement>();
    const { container } = renderControls({ onSeekToTime, progressTrackRef, timeLabelRef });
    const bar = within(container).getByRole("progressbar");
    stubBarRect(bar);

    fireEvent.pointerDown(bar, { pointerId: 1, clientX: 25 });
    fireEvent.pointerMove(bar, { pointerId: 1, clientX: 50 });
    // The preview tracks the pointer: bar and readout show the drag target…
    expect(progressTrackRef.current!.style.width).toBe("50%");
    expect(timeLabelRef.current!.textContent).toBe("0:04 / 0:08");
    // …but nothing commits per move (a seek restarts the narration clip).
    expect(onSeekToTime).not.toHaveBeenCalled();

    fireEvent.pointerMove(bar, { pointerId: 1, clientX: 75 });
    fireEvent.pointerUp(bar, { pointerId: 1, clientX: 75 });
    expect(onSeekToTime).toHaveBeenCalledTimes(1);
    expect(onSeekToTime).toHaveBeenCalledWith(0.75 * TIMELINE.totalDurationMs);
  });

  it("hands the progress DOM to the drag via scrubbingRef for the gesture's duration", () => {
    const scrubbingRef = { current: false };
    const { container } = renderControls({ scrubbingRef });
    const bar = within(container).getByRole("progressbar");
    stubBarRect(bar);

    fireEvent.pointerDown(bar, { pointerId: 1, clientX: 10 });
    expect(scrubbingRef.current).toBe(true);

    fireEvent.pointerUp(bar, { pointerId: 1, clientX: 60 });
    expect(scrubbingRef.current).toBe(false);
  });

  it("ignores stray pointer moves without a preceding capture", () => {
    const onSeekToTime = vi.fn();
    const progressTrackRef = createRef<HTMLDivElement>();
    const { container } = renderControls({ onSeekToTime, progressTrackRef });
    const bar = within(container).getByRole("progressbar");
    stubBarRect(bar);

    fireEvent.pointerMove(bar, { pointerId: 1, clientX: 50 });
    fireEvent.pointerUp(bar, { pointerId: 1, clientX: 50 });
    expect(progressTrackRef.current!.style.width).toBe("");
    expect(onSeekToTime).not.toHaveBeenCalled();
  });

  it("commits a cancelled gesture at its last position (touch stolen by scroll)", () => {
    const onSeekToTime = vi.fn();
    const scrubbingRef = { current: false };
    const { container } = renderControls({ onSeekToTime, scrubbingRef });
    const bar = within(container).getByRole("progressbar");
    stubBarRect(bar);

    fireEvent.pointerDown(bar, { pointerId: 1, clientX: 30 });
    fireEvent.pointerCancel(bar, { pointerId: 1, clientX: 30 });
    expect(onSeekToTime).toHaveBeenCalledWith(0.3 * TIMELINE.totalDurationMs);
    expect(scrubbingRef.current).toBe(false);
  });

  it("clamps drag positions outside the bar to its ends", () => {
    const onSeekToTime = vi.fn();
    const { container } = renderControls({ onSeekToTime });
    const bar = within(container).getByRole("progressbar");
    stubBarRect(bar);

    fireEvent.pointerDown(bar, { pointerId: 1, clientX: 50 });
    fireEvent.pointerMove(bar, { pointerId: 1, clientX: 240 });
    fireEvent.pointerUp(bar, { pointerId: 1, clientX: 240 });
    expect(onSeekToTime).toHaveBeenCalledWith(TIMELINE.totalDurationMs);
  });

  it("marks step boundaries as chapter ticks", () => {
    const { container } = renderControls();
    const bar = within(container).getByRole("progressbar");
    // One tick per interior step start (step 0 has none).
    const ticks = bar.querySelectorAll('[style*="left: 50%"]');
    expect(ticks.length).toBe(1);
  });
});
