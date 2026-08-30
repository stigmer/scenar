import { describe, expect, it } from "vitest";
import type { StepAction } from "../scenario/step-action.js";
import { deriveActionEvents, type ActionEvent } from "./derive-action-events.js";
import {
  CLICK_DELAY_MS,
  DRAG_SETTLE_MS,
  HOVER_HOLD_MS,
  TYPE_CHAR_DELAY_MS,
} from "../timing/constants.js";

const DURATION = 2000;

function offsets(events: ActionEvent[]): Record<string, number[]> {
  const byKind: Record<string, number[]> = {};
  for (const e of events) {
    (byKind[e.kind] ??= []).push(e.offsetMs);
  }
  return byKind;
}

describe("deriveActionEvents", () => {
  it("click: cursor move at fireAt, dispatch after the travel window", () => {
    const action: StepAction = { atPercent: 0.5, type: "click", target: "btn" };
    expect(offsets(deriveActionEvents(action, DURATION))).toEqual({
      "cursor-move": [1000],
      "click-dispatch": [1000 + CLICK_DELAY_MS],
    });
  });

  it("type: one keystroke per character at the typing cadence", () => {
    const action: StepAction = { atPercent: 0, type: "type", target: "input", text: "abc" };
    const events = deriveActionEvents(action, DURATION);
    const keystrokes = events.filter((e) => e.kind === "keystroke");

    expect(events[0]).toEqual({ kind: "cursor-move", offsetMs: 0 });
    expect(keystrokes).toEqual([
      { kind: "keystroke", offsetMs: CLICK_DELAY_MS, charIndex: 0 },
      { kind: "keystroke", offsetMs: CLICK_DELAY_MS + TYPE_CHAR_DELAY_MS, charIndex: 1 },
      { kind: "keystroke", offsetMs: CLICK_DELAY_MS + 2 * TYPE_CHAR_DELAY_MS, charIndex: 2 },
    ]);
  });

  it("type: honors a per-action typeDelay override", () => {
    const action: StepAction = {
      atPercent: 0,
      type: "type",
      target: "input",
      text: "ab",
      typeDelay: 120,
    };
    const keystrokes = deriveActionEvents(action, DURATION).filter(
      (e) => e.kind === "keystroke",
    );
    expect(keystrokes.map((e) => e.offsetMs)).toEqual([
      CLICK_DELAY_MS,
      CLICK_DELAY_MS + 120,
    ]);
  });

  it("type: empty text is a no-op, exactly like the schedulers", () => {
    const action: StepAction = { atPercent: 0.5, type: "type", target: "input", text: "" };
    expect(deriveActionEvents(action, DURATION)).toEqual([]);
  });

  it("type: unicode text counts UTF-16 code units, matching substring typing", () => {
    // The schedulers type text.substring(0, i + 1) for i < text.length, so
    // the derivation must count the same units — an emoji surrogate pair
    // yields two keystrokes, one per code unit.
    const action: StepAction = { atPercent: 0, type: "type", target: "input", text: "é🙂" };
    const keystrokes = deriveActionEvents(action, DURATION).filter(
      (e) => e.kind === "keystroke",
    );
    expect(keystrokes).toHaveLength("é🙂".length);
  });

  it("hover: enter after travel, leave after the hold", () => {
    const action: StepAction = { atPercent: 0.25, type: "hover", target: "tip" };
    expect(offsets(deriveActionEvents(action, DURATION))).toEqual({
      "cursor-move": [500],
      "hover-enter": [500 + CLICK_DELAY_MS],
      "hover-leave": [500 + CLICK_DELAY_MS + HOVER_HOLD_MS],
    });
  });

  it("hover: honors a per-action hoverDuration override", () => {
    const action: StepAction = {
      atPercent: 0,
      type: "hover",
      target: "tip",
      hoverDuration: 200,
    };
    const leave = deriveActionEvents(action, DURATION).find((e) => e.kind === "hover-leave");
    expect(leave?.offsetMs).toBe(CLICK_DELAY_MS + 200);
  });

  it("drag: press, move, release along the settle chain", () => {
    const action: StepAction = {
      atPercent: 0.1,
      type: "drag",
      target: "card",
      dragTarget: "column",
    };
    expect(offsets(deriveActionEvents(action, DURATION))).toEqual({
      "cursor-move": [200],
      "drag-press": [200 + CLICK_DELAY_MS],
      "drag-move": [200 + CLICK_DELAY_MS + DRAG_SETTLE_MS],
      "drag-release": [200 + CLICK_DELAY_MS + DRAG_SETTLE_MS + CLICK_DELAY_MS],
    });
  });

  it.each([
    ["scroll_to", "list"],
    ["set_cursor", "btn"],
    ["clear_cursor", undefined],
  ] as const)("%s: a single dispatch at fireAt", (type, target) => {
    const action: StepAction = { atPercent: 0.5, type, target };
    expect(deriveActionEvents(action, DURATION)).toEqual([
      { kind: "simple-dispatch", offsetMs: 1000 },
    ]);
  });

  it("viewport_transition: fires at fireAt with no travel delay", () => {
    const action: StepAction = { atPercent: 0.5, type: "viewport_transition", target: "hero" };
    expect(deriveActionEvents(action, DURATION)).toEqual([
      { kind: "viewport-transition", offsetMs: 1000 },
    ]);
  });

  it.each([
    ["atPercent 0.0 anchors at step start", 0.0, 0],
    ["atPercent 1.0 anchors at step end", 1.0, DURATION],
  ])("%s", (_name, atPercent, expected) => {
    const action: StepAction = { atPercent, type: "click", target: "btn" };
    expect(deriveActionEvents(action, DURATION)[0]?.offsetMs).toBe(expected);
  });

  it("zero-duration step: every anchor collapses to the fixed offsets", () => {
    const action: StepAction = { atPercent: 0.7, type: "click", target: "btn" };
    expect(offsets(deriveActionEvents(action, 0))).toEqual({
      "cursor-move": [0],
      "click-dispatch": [CLICK_DELAY_MS],
    });
  });
});
