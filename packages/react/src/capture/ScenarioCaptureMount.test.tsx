import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { useState } from "react";
import type { ScenarioStep } from "@scenar/core";
import {
  ScenarioCaptureMount,
  SHOT_FRAME_SELECTOR,
  type ScenarioCaptureDriver,
} from "./ScenarioCaptureMount.js";

/**
 * The lab scenario — a port of the 2026-07-28 determinism spike's fixture.
 * Cross-step React state (typed input text, a click-created list item)
 * lives inside the rendered content, so these tests prove the walk
 * semantics the capture path depends on: state created by one step's
 * interactions must still be present when a later step's shot is taken.
 */
function LabScreen({ label }: { label: string }) {
  const [name, setName] = useState("");
  const [items, setItems] = useState<string[]>([]);
  return (
    <div>
      <div data-testid="lab-label">{label}</div>
      <input
        data-cursor-target="name-input"
        data-testid="lab-input"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <button
        type="button"
        data-cursor-target="add-button"
        onClick={() => setItems((prev) => [...prev, `Item ${prev.length + 1}`])}
      >
        Add item
      </button>
      <div data-testid="lab-items">{items.join(", ")}</div>
    </div>
  );
}

interface LabData {
  label: string;
}

// The interactions sit on step 1 — an *intermediate* step — deliberately:
// a cold jump skips intermediate steps' interactions entirely (the harness
// step index lags the TimeSource by one effect cycle, so only the lagged
// step's actions could ever replay), which is exactly the state loss the
// spike measured and the reason capture must walk. Step 1 lasts 3000ms
// (step 2's delayMs): the click fires at 600ms (+450ms dispatch) and
// typing runs 1500..~2550ms — both tails fit inside the step, per the
// authoring rule the spike surfaced.
const LAB_STEPS: ScenarioStep<LabData>[] = [
  { delayMs: 0, data: { label: "intro" } },
  {
    delayMs: 1000,
    data: { label: "acting" },
    interactions: [
      { type: "click", target: "add-button", atPercent: 0.2 },
      { type: "type", target: "name-input", text: "Acme rollout", atPercent: 0.5 },
    ],
  },
  { delayMs: 3000, data: { label: "review" }, shot: "after-interactions" },
  { delayMs: 1000, data: { label: "done" }, shot: "finale" },
];

const renderLabStep = (data: LabData) => <LabScreen label={data.label} />;

/** Mount the capture tree and resolve its driver (or reject with onError). */
function mountLab(steps: ScenarioStep<LabData>[] = LAB_STEPS) {
  let driver: ScenarioCaptureDriver | undefined;
  let error: Error | undefined;
  const utils = render(
    <ScenarioCaptureMount
      scenarioId="lab"
      steps={steps}
      renderStep={renderLabStep}
      canonicalWidth={896}
      shellHeight={480}
      onReady={(d) => {
        driver = d;
      }}
      onError={(e) => {
        error = e;
      }}
    />,
  );
  return { ...utils, driver: () => driver, error: () => error };
}

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

describe("ScenarioCaptureMount driver", () => {
  it("installs a driver with validated shots in timeline order", () => {
    const { driver, error } = mountLab();
    expect(error()).toBeUndefined();
    const d = driver();
    expect(d).toBeDefined();
    // Starts: [0, 1000, 4000, 5000]; total 5000 + 3000 dwell.
    expect(d!.shots).toEqual([
      { name: "after-interactions", timeMs: 4999, stepIndex: 2 },
      { name: "finale", timeMs: 7999, stepIndex: 3 },
    ]);
    expect(d!.timeline.stepStartTimesMs).toEqual([0, 1000, 4000, 5000]);
    expect(d!.frameSelector).toBe(SHOT_FRAME_SELECTOR);
  });

  it("reports invalid shot declarations through onError, not onReady", () => {
    const duplicated = LAB_STEPS.map((step) =>
      step.shot ? { ...step, shot: "twice" } : step,
    );
    const { driver, error } = mountLab(duplicated);
    expect(driver()).toBeUndefined();
    expect(error()?.message).toMatch(/steps 2 and 3 both declare shot "twice"/);
  });

  it("renders the frame marker and no cursor overlay", () => {
    const { container } = mountLab();
    expect(container.querySelector(SHOT_FRAME_SELECTOR)).not.toBeNull();
    // The Cursor overlay (motion div, absolute z-50) must never render in
    // capture — it is the engine's only measured nondeterminism (D3).
    expect(container.querySelector(".z-50")).toBeNull();
  });
});

describe("ScenarioCaptureMount walk semantics", () => {
  it("a walk carries cross-step interaction state into a later shot", async () => {
    const { driver, getByTestId, container } = mountLab();
    const d = driver()!;

    await d.walkTo(d.shots[0]!.timeMs);

    // Step 1's interactions landed in real React state...
    expect((getByTestId("lab-input") as HTMLInputElement).value).toBe("Acme rollout");
    expect(getByTestId("lab-items").textContent).toBe("Item 1");
    // ...and the timeline is standing on the shot's step.
    expect(container.querySelector('[data-demo-step="2"]')).not.toBeNull();
    expect(getByTestId("lab-label").textContent).toBe("review");
  });

  it("state survives walking on to the final shot, and the click fired exactly once", async () => {
    const { driver, getByTestId } = mountLab();
    const d = driver()!;

    await d.walkTo(d.shots[0]!.timeMs);
    await d.walkTo(d.shots[1]!.timeMs);

    expect(getByTestId("lab-label").textContent).toBe("done");
    expect((getByTestId("lab-input") as HTMLInputElement).value).toBe("Acme rollout");
    // The firedRef contract: one declared click, one Item — a re-fired
    // interaction would have appended "Item 2".
    expect(getByTestId("lab-items").textContent).toBe("Item 1");
  });

  it("a cold jump DROPS earlier steps' interaction state (why walkTo exists)", () => {
    const { driver, getByTestId } = mountLab();
    const d = driver()!;

    d.setTime(d.shots[0]!.timeMs);

    // The step index derives correctly from time, but the click-created
    // item and typed text never happened — matching the spike's finding
    // that capture must be a sequential catch-up walk, never a cold jump.
    expect(getByTestId("lab-label").textContent).toBe("review");
    expect((getByTestId("lab-input") as HTMLInputElement).value).toBe("");
    expect(getByTestId("lab-items").textContent).toBe("");
  });
});
