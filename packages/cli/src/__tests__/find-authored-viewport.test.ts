import { describe, expect, it } from "vitest";
import { findAuthoredViewport } from "../util/load-ts.js";

const STEPS = [{ delayMs: 0 }, { delayMs: 1500 }];

describe("findAuthoredViewport", () => {
  it("finds the viewport riding a scenario-shaped export (createScenario)", () => {
    const exports = {
      default: {
        viewport: { width: 1440, height: 900 },
        views: {},
        steps: STEPS,
      },
    };
    expect(findAuthoredViewport(exports)).toEqual({ width: 1440, height: 900 });
  });

  it("finds a bare `viewport` named export (directory-form authoring)", () => {
    const exports = {
      steps: STEPS,
      viewport: { width: 1280, height: 800 },
    };
    expect(findAuthoredViewport(exports)).toEqual({ width: 1280, height: 800 });
  });

  it("prefers the scenario-shaped export over a bare named export", () => {
    // The scenario's viewport is inseparable from the steps it sizes; a
    // stray `viewport` constant must not override it.
    const exports = {
      default: { viewport: { width: 1440, height: 900 }, steps: STEPS },
      viewport: { width: 640, height: 480 },
    };
    expect(findAuthoredViewport(exports)).toEqual({ width: 1440, height: 900 });
  });

  it("returns null when the module authors no viewport", () => {
    expect(findAuthoredViewport({ steps: STEPS })).toBeNull();
    expect(findAuthoredViewport({})).toBeNull();
  });

  it("ignores a viewport on an object that carries no steps", () => {
    // Not a scenario export — e.g. some unrelated config object.
    const exports = {
      config: { viewport: { width: 1440, height: 900 } },
      steps: STEPS,
    };
    expect(findAuthoredViewport(exports)).toBeNull();
  });

  it("rejects malformed viewport shapes", () => {
    expect(findAuthoredViewport({ viewport: { width: 1440 } })).toBeNull();
    expect(findAuthoredViewport({ viewport: { width: "1440", height: 900 } })).toBeNull();
    expect(findAuthoredViewport({ viewport: { width: 0, height: 900 } })).toBeNull();
    expect(findAuthoredViewport({ viewport: { width: -10, height: 900 } })).toBeNull();
    expect(findAuthoredViewport({ viewport: [1440, 900] })).toBeNull();
    expect(findAuthoredViewport({ viewport: null })).toBeNull();
  });
});
