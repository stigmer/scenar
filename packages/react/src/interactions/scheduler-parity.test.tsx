import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import {
  type ActionEvent,
  type ScenarioStep,
  type StepAction,
  deriveActionEvents,
  getStepDurationMs,
} from "@scenar/core";
import { useStepInteractions } from "./useStepInteractions.js";
import { TimeSourceProvider } from "../time/TimeSource.js";

/**
 * Parity suite: pins both interaction schedulers' observable dispatch
 * times to `deriveActionEvents` — the canonical statement of the offset
 * math in `@scenar/core` that SFX placement (browser and video export)
 * is built on. If a scheduler's timing drifts from the derivation, a
 * sound would play at a moment its visual does not happen; this suite is
 * what makes that a test failure instead of a shipped artifact.
 *
 * (Also the schedulers' first characterization coverage — planned
 * follow-up work migrates them onto the core derivation itself.)
 */

/** One observed dispatch: which effect fired, and when (ms from mount). */
interface Recorded {
  kind: string;
  at: number;
}

const recorded: Recorded[] = [];
const record = (kind: string) => {
  recorded.push({ kind, at: Date.now() });
};

vi.mock("./effects/click.js", () => ({ dispatchClick: () => record("click-dispatch") }));
vi.mock("./effects/type.js", () => ({
  typeTextIntoTarget: (_a: unknown, chars: string) => record(`keystroke-${chars.length - 1}`),
}));
vi.mock("./effects/hover.js", () => ({
  dispatchHoverEnter: () => record("hover-enter"),
  dispatchHoverLeave: () => record("hover-leave"),
}));
vi.mock("./effects/drag.js", () => ({
  dispatchDragPress: () => record("drag-press"),
  dispatchDragRelease: () => record("drag-release"),
}));
vi.mock("./effects/viewport-transition.js", () => ({
  applyViewportTransition: () => record("viewport-transition"),
}));
vi.mock("./effects/scroll-to.js", () => ({ executeScrollTo: () => record("simple-dispatch") }));
vi.mock("./effects/set-cursor.js", () => ({ executeSetCursor: () => record("simple-dispatch") }));
vi.mock("./effects/clear-cursor.js", () => ({
  executeClearCursor: () => record("simple-dispatch"),
}));

/**
 * Map a derived `ActionEvent` to the record the schedulers produce for
 * it. `cursor-move` and `drag-move` both surface as `setCursorTarget`
 * calls; everything else maps to its mocked effect.
 */
function expectedRecordKind(event: ActionEvent): string {
  switch (event.kind) {
    case "cursor-move":
    case "drag-move":
      return "cursor-move";
    case "keystroke":
      return `keystroke-${event.charIndex}`;
    default:
      return event.kind;
  }
}

function makeSteps(action: StepAction): ScenarioStep<unknown>[] {
  return [
    { delayMs: 0, data: {}, interactions: [action] },
    { delayMs: 2000, data: {} },
  ] as ScenarioStep<unknown>[];
}

interface HarnessProps {
  steps: ScenarioStep<unknown>[];
  playbackRate?: number;
  /** Omitted in the parity suites: the scheduler defaults it to true. */
  playing?: boolean;
}

function Harness({ steps, playbackRate = 1, playing }: HarnessProps) {
  useStepInteractions({
    stepIndex: 0,
    narrationManifest: undefined,
    containerRef: { current: null },
    setCursorTarget: () => record("cursor-move"),
    steps,
    playbackRate,
    playing,
  });
  return null;
}

const ACTIONS: Record<string, StepAction> = {
  click: { atPercent: 0.5, type: "click", target: "btn" },
  type: { atPercent: 0.25, type: "type", target: "input", text: "abc", typeDelay: 80 },
  hover: { atPercent: 0.1, type: "hover", target: "tip", hoverDuration: 300 },
  drag: { atPercent: 0, type: "drag", target: "card", dragTarget: "column" },
  viewport_transition: { atPercent: 0.7, type: "viewport_transition", target: "hero" },
  scroll_to: { atPercent: 0.4, type: "scroll_to", target: "list" },
};

beforeEach(() => {
  recorded.length = 0;
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe.each(Object.entries(ACTIONS))(
  "browser scheduler parity: %s",
  (_name, action) => {
    it("dispatches exactly the derived events at the derived offsets", () => {
      const steps = makeSteps(action);
      const duration = getStepDurationMs(0, undefined, steps);
      const derived = deriveActionEvents(action, duration);

      render(<Harness steps={steps} />);
      vi.advanceTimersByTime(duration + 10_000);

      const expected = derived
        .map((e) => ({ kind: expectedRecordKind(e), at: e.offsetMs }))
        .sort((a, b) => a.at - b.at || a.kind.localeCompare(b.kind));
      const actual = [...recorded].sort(
        (a, b) => a.at - b.at || a.kind.localeCompare(b.kind),
      );
      expect(actual).toEqual(expected);
    });
  },
);

describe("browser scheduler: pause/resume (#6)", () => {
  it("suspends pending events while paused and fires the remainder on resume", () => {
    const action = ACTIONS.hover!;
    const steps = makeSteps(action);
    const duration = getStepDurationMs(0, undefined, steps);
    // hover derives three events: cursor-move, hover-enter, hover-leave.
    const derived = deriveActionEvents(action, duration);
    const firstOffset = derived[0]!.offsetMs;

    const view = render(<Harness steps={steps} playing />);
    vi.advanceTimersByTime(firstOffset);
    expect(recorded).toHaveLength(1);

    // Pause: pending events stop firing, no matter how long the pause lasts.
    view.rerender(<Harness steps={steps} playing={false} />);
    vi.advanceTimersByTime(60_000);
    expect(recorded).toHaveLength(1);

    // Resume: exactly the remaining events fire, each at its remaining
    // offset — the paused minute is excluded from the step's elapsed time,
    // and the already-fired event does not repeat.
    const resumedAt = Date.now();
    view.rerender(<Harness steps={steps} playing />);
    vi.advanceTimersByTime(duration + 10_000);

    const expected = derived
      .map((e, i) => ({
        kind: expectedRecordKind(e),
        at: i === 0 ? firstOffset : resumedAt + (e.offsetMs - firstOffset),
      }))
      .sort((a, b) => a.at - b.at || a.kind.localeCompare(b.kind));
    const actual = [...recorded].sort(
      (a, b) => a.at - b.at || a.kind.localeCompare(b.kind),
    );
    expect(actual).toEqual(expected);
  });

  it("dispatches nothing when mounted paused", () => {
    render(<Harness steps={makeSteps(ACTIONS.click!)} playing={false} />);
    vi.advanceTimersByTime(60_000);
    expect(recorded).toHaveLength(0);
  });

  it("a mid-step rate change does not re-fire events that already fired", () => {
    const action = ACTIONS.click!;
    const steps = makeSteps(action);
    const duration = getStepDurationMs(0, undefined, steps);
    const [cursor, dispatch] = deriveActionEvents(action, duration);

    const view = render(<Harness steps={steps} playbackRate={1} />);
    vi.advanceTimersByTime(cursor!.offsetMs);
    expect(recorded).toHaveLength(1);

    // Double the speed mid-step. The old scheduler re-armed every timer
    // from the step's entry, replaying the cursor move; the elapsed bank
    // plus the fired ledger must schedule only the remaining dispatch, at
    // its remaining offset scaled by the new rate.
    const changedAt = Date.now();
    view.rerender(<Harness steps={steps} playbackRate={2} />);
    vi.advanceTimersByTime(duration + 10_000);

    expect(recorded).toEqual([
      { kind: "cursor-move", at: cursor!.offsetMs },
      {
        kind: "click-dispatch",
        at: changedAt + (dispatch!.offsetMs - cursor!.offsetMs) / 2,
      },
    ]);
  });
});

describe("browser scheduler parity: playback rate", () => {
  it("scales every derived offset by the rate", () => {
    const action = ACTIONS.type!;
    const steps = makeSteps(action);
    const duration = getStepDurationMs(0, undefined, steps);
    const derived = deriveActionEvents(action, duration);

    render(<Harness steps={steps} playbackRate={2} />);
    vi.advanceTimersByTime(duration + 10_000);

    const expected = derived
      .map((e) => ({ kind: expectedRecordKind(e), at: e.offsetMs / 2 }))
      .sort((a, b) => a.at - b.at || a.kind.localeCompare(b.kind));
    const actual = [...recorded].sort(
      (a, b) => a.at - b.at || a.kind.localeCompare(b.kind),
    );
    expect(actual).toEqual(expected);
  });
});

describe.each(Object.entries(ACTIONS))(
  "frame-driven scheduler parity: %s",
  (_name, action) => {
    it("fires each derived event exactly when frame time crosses its offset", () => {
      const steps = makeSteps(action);
      const duration = getStepDurationMs(0, undefined, steps);
      const derived = deriveActionEvents(action, duration);

      // Advance frame time through every derived offset (plus a probe one
      // millisecond earlier) and record dispatches against the frame time
      // instead of the wall clock.
      const offsets = [...new Set(derived.map((e) => e.offsetMs))].sort((a, b) => a - b);
      const sampleTimes = [
        ...new Set(offsets.flatMap((t) => (t > 0 ? [t - 1, t] : [t]))),
      ].sort((a, b) => a - b);

      let frameTimeMs = 0;
      const frameHarness = (t: number) => (
        <TimeSourceProvider currentTimeMs={t} stepStartTimesMs={[0, duration]}>
          <Harness steps={steps} />
        </TimeSourceProvider>
      );

      const view = render(frameHarness(0));

      const observed: Array<{ kind: string; at: number }> = [];
      const drain = () => {
        for (const r of recorded.splice(0)) {
          observed.push({ kind: r.kind, at: frameTimeMs });
        }
      };
      drain();

      for (const t of sampleTimes) {
        frameTimeMs = t;
        view.rerender(frameHarness(t));
        drain();
      }

      const expected = derived
        .map((e) => ({ kind: expectedRecordKind(e), at: e.offsetMs }))
        .sort((a, b) => a.at - b.at || a.kind.localeCompare(b.kind));
      const actual = [...observed].sort(
        (a, b) => a.at - b.at || a.kind.localeCompare(b.kind),
      );
      expect(actual).toEqual(expected);
    });
  },
);
