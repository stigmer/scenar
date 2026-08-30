import { describe, expect, it } from "vitest";
import type { NarrationManifest } from "../narration/types.js";
import type { ScenarioStep } from "../scenario/types.js";
import type { StepAction } from "../scenario/step-action.js";
import { deriveSfxTimeline } from "./derive-sfx-timeline.js";
import {
  CLICK_DELAY_MS,
  DRAG_SETTLE_MS,
  TYPE_CHAR_DELAY_MS,
} from "../timing/constants.js";

function step(
  delayMs: number,
  interactions?: StepAction[],
): ScenarioStep<Record<string, never>> {
  return { delayMs, data: {}, interactions };
}

describe("deriveSfxTimeline", () => {
  it("returns no events for a scenario without interactions", () => {
    expect(deriveSfxTimeline([step(0), step(1000)], undefined)).toEqual([]);
  });

  it("click yields one click sound at the dispatch moment", () => {
    const steps = [
      step(0, [{ atPercent: 0.5, type: "click", target: "btn" }]),
      step(2000),
    ];
    // Step 0's duration is the next step's delayMs (2000) — no narration.
    expect(deriveSfxTimeline(steps, undefined)).toEqual([
      { stepIndex: 0, offsetMs: 1000 + CLICK_DELAY_MS, sound: "click" },
    ]);
  });

  it("typing yields one keystroke sound per character", () => {
    const steps = [
      step(0, [{ atPercent: 0, type: "type", target: "input", text: "hi" }]),
      step(1000),
    ];
    expect(deriveSfxTimeline(steps, undefined)).toEqual([
      { stepIndex: 0, offsetMs: CLICK_DELAY_MS, sound: "keystroke" },
      { stepIndex: 0, offsetMs: CLICK_DELAY_MS + TYPE_CHAR_DELAY_MS, sound: "keystroke" },
    ]);
  });

  it("drag yields click sounds at press and release, nothing between", () => {
    const steps = [
      step(0, [{ atPercent: 0, type: "drag", target: "card", dragTarget: "col" }]),
      step(1000),
    ];
    expect(deriveSfxTimeline(steps, undefined)).toEqual([
      { stepIndex: 0, offsetMs: CLICK_DELAY_MS, sound: "click" },
      {
        stepIndex: 0,
        offsetMs: CLICK_DELAY_MS + DRAG_SETTLE_MS + CLICK_DELAY_MS,
        sound: "click",
      },
    ]);
  });

  it.each([
    ["hover", { atPercent: 0.5, type: "hover", target: "tip" } as StepAction],
    ["scroll_to", { atPercent: 0.5, type: "scroll_to", target: "list" } as StepAction],
    ["set_cursor", { atPercent: 0, type: "set_cursor", target: "btn" } as StepAction],
    ["clear_cursor", { atPercent: 1, type: "clear_cursor" } as StepAction],
    [
      "viewport_transition",
      { atPercent: 0.5, type: "viewport_transition", target: "hero" } as StepAction,
    ],
  ])("%s stays silent", (_name, action) => {
    const steps = [step(0, [action]), step(1000)];
    expect(deriveSfxTimeline(steps, undefined)).toEqual([]);
  });

  it("narration duration anchors offsets when a clip exists", () => {
    const steps = [
      step(0, [{ atPercent: 0.5, type: "click", target: "btn" }]),
      step(500),
    ];
    const manifest: NarrationManifest = {
      steps: [{ src: "./step-0.mp3", durationMs: 4000 }, null],
    };
    // Duration comes from the clip (4000), not the next delay (500).
    expect(deriveSfxTimeline(steps, manifest)).toEqual([
      { stepIndex: 0, offsetMs: 2000 + CLICK_DELAY_MS, sound: "click" },
    ]);
  });

  it("orders events by step, then by offset within the step", () => {
    const steps = [
      step(0, [
        // Authored out of time order within the step.
        { atPercent: 0.8, type: "click", target: "b" },
        { atPercent: 0.1, type: "click", target: "a" },
      ]),
      step(1000, [{ atPercent: 0, type: "click", target: "c" }]),
      step(1000),
    ];
    const events = deriveSfxTimeline(steps, undefined);
    expect(events.map((e) => [e.stepIndex, e.offsetMs])).toEqual([
      [0, 100 + CLICK_DELAY_MS],
      [0, 800 + CLICK_DELAY_MS],
      [1, CLICK_DELAY_MS],
    ]);
  });

  it("last step uses the engine's fallback duration", () => {
    const steps = [step(0, [{ atPercent: 1, type: "click", target: "btn" }])];
    // Single-step scenario: getStepDurationMs falls back to 3000.
    expect(deriveSfxTimeline(steps, undefined)).toEqual([
      { stepIndex: 0, offsetMs: 3000 + CLICK_DELAY_MS, sound: "click" },
    ]);
  });
});
