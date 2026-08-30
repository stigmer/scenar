import { describe, it, expect } from "vitest";
import { validateScenario } from "../validate/scenario-validator.js";

function validScenario() {
  return {
    viewport: { width: 896, height: 540 },
    steps: [
      {
        view: "intro",
        delayMs: 0,
        narrationText: "Welcome to the demo.",
      },
    ],
  };
}

describe("validateScenario", () => {
  // --- Happy path ---

  it("accepts a valid scenario", () => {
    const result = validateScenario(validScenario());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("accepts a scenario without viewport (optional)", () => {
    const s = validScenario();
    delete (s as Record<string, unknown>)["viewport"];
    expect(validateScenario(s).valid).toBe(true);
  });

  it("accepts a step without interactions (optional)", () => {
    expect(validateScenario(validScenario()).valid).toBe(true);
  });

  it("accepts a valid scenario with interactions", () => {
    const s = validScenario();
    s.steps[0] = {
      ...s.steps[0]!,
      interactions: [
        { atPercent: 0.5, type: 5, target: "my-btn" },
      ],
    } as typeof s.steps[0];
    expect(validateScenario(s).valid).toBe(true);
  });

  // --- Presenter (per-step opt-in, requires narration) ---

  it("accepts presenter: true on a narrated step", () => {
    const s = validScenario();
    s.steps[0] = { ...s.steps[0]!, presenter: true } as typeof s.steps[0];
    expect(validateScenario(s).valid).toBe(true);
  });

  it("accepts presenter: false on a step without narration", () => {
    const s = validScenario();
    s.steps[0] = {
      view: "intro",
      delayMs: 0,
      presenter: false,
    } as unknown as typeof s.steps[0];
    expect(validateScenario(s).valid).toBe(true);
  });

  it("rejects presenter: true on a step without narration, naming step, field, and rule", () => {
    const s = validScenario();
    s.steps[0] = {
      view: "intro",
      delayMs: 0,
      presenter: true,
    } as unknown as typeof s.steps[0];

    const result = validateScenario(s);
    expect(result.valid).toBe(false);
    expect(result.errors[0]!.path).toBe("steps[0].presenter");
    expect(result.errors[0]!.reason).toBe(
      "presenter requires narration_text — a presenter clip is derived from the step's narration audio.",
    );
  });

  it("rejects presenter: true when narrationText is empty", () => {
    const s = validScenario();
    s.steps[0] = {
      ...s.steps[0]!,
      narrationText: "",
      presenter: true,
    } as typeof s.steps[0];

    const result = validateScenario(s);
    expect(result.valid).toBe(false);
    expect(result.errors[0]!.path).toBe("steps[0].presenter");
  });

  it("rejects a non-boolean presenter", () => {
    const s = validScenario();
    s.steps[0] = {
      ...s.steps[0]!,
      presenter: "yes",
    } as unknown as typeof s.steps[0];

    const result = validateScenario(s);
    expect(result.valid).toBe(false);
    expect(result.errors[0]!.path).toBe("steps[0].presenter");
    expect(result.errors[0]!.reason).toBe("presenter must be a boolean.");
  });

  // --- Root-level errors ---

  it("rejects null", () => {
    const result = validateScenario(null);
    expect(result.valid).toBe(false);
    expect(result.errors[0]!.reason).toMatch(/must be an object/);
  });

  it("rejects non-object", () => {
    const result = validateScenario("not an object");
    expect(result.valid).toBe(false);
  });

  // --- Steps errors ---

  it("rejects missing steps", () => {
    const result = validateScenario({ viewport: { width: 800, height: 600 } });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: "steps", reason: expect.stringMatching(/must be an array/) }),
    );
  });

  it("rejects empty steps array", () => {
    const result = validateScenario({ steps: [] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: "steps", reason: expect.stringMatching(/at least one/) }),
    );
  });

  it("rejects step with missing view", () => {
    const result = validateScenario({ steps: [{ delayMs: 0 }] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: "steps[0].view" }),
    );
  });

  it("rejects step with empty view string", () => {
    const result = validateScenario({ steps: [{ view: "", delayMs: 0 }] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: "steps[0].view" }),
    );
  });

  it("rejects step with negative delayMs", () => {
    const result = validateScenario({ steps: [{ view: "x", delayMs: -1 }] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: "steps[0].delayMs" }),
    );
  });

  // --- Viewport errors ---

  it("rejects viewport with zero width", () => {
    const result = validateScenario({
      viewport: { width: 0, height: 540 },
      steps: [{ view: "x", delayMs: 0 }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: "viewport.width" }),
    );
  });

  it("rejects viewport with negative height", () => {
    const result = validateScenario({
      viewport: { width: 800, height: -10 },
      steps: [{ view: "x", delayMs: 0 }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: "viewport.height" }),
    );
  });

  // --- Interaction errors ---

  it("rejects interaction with atPercent below 0", () => {
    const result = validateScenario({
      steps: [{
        view: "x",
        delayMs: 0,
        interactions: [{ atPercent: -0.1, type: 3, target: "btn" }],
      }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: "steps[0].interactions[0].atPercent" }),
    );
  });

  it("rejects interaction with atPercent above 1", () => {
    const result = validateScenario({
      steps: [{
        view: "x",
        delayMs: 0,
        interactions: [{ atPercent: 1.5, type: 3, target: "btn" }],
      }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: "steps[0].interactions[0].atPercent" }),
    );
  });

  it("rejects interaction with unknown action type number", () => {
    const result = validateScenario({
      steps: [{
        view: "x",
        delayMs: 0,
        interactions: [{ atPercent: 0.5, type: 99, target: "btn" }],
      }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: "steps[0].interactions[0].type" }),
    );
  });

  it("rejects interaction with 'unspecified' action type (0)", () => {
    const result = validateScenario({
      steps: [{
        view: "x",
        delayMs: 0,
        interactions: [{ atPercent: 0.5, type: 0, target: "btn" }],
      }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        path: "steps[0].interactions[0].type",
        reason: expect.stringMatching(/unspecified/),
      }),
    );
  });

  it("accepts action type by string name", () => {
    const result = validateScenario({
      steps: [{
        view: "x",
        delayMs: 0,
        interactions: [{ atPercent: 0.5, type: "click", target: "btn" }],
      }],
    });
    expect(result.valid).toBe(true);
  });

  it("rejects unknown action type string", () => {
    const result = validateScenario({
      steps: [{
        view: "x",
        delayMs: 0,
        interactions: [{ atPercent: 0.5, type: "explode", target: "btn" }],
      }],
    });
    expect(result.valid).toBe(false);
  });

  it("rejects missing target for click action", () => {
    const result = validateScenario({
      steps: [{
        view: "x",
        delayMs: 0,
        interactions: [{ atPercent: 0.5, type: 3 }],
      }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: "steps[0].interactions[0].target" }),
    );
  });

  // --- Config validation ---

  it("rejects type action without typeConfig", () => {
    const result = validateScenario({
      steps: [{
        view: "x",
        delayMs: 0,
        interactions: [{ atPercent: 0.5, type: 4, target: "input" }],
      }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        path: "steps[0].interactions[0].typeConfig",
        reason: expect.stringMatching(/required/),
      }),
    );
  });

  it("rejects typeConfig with empty text", () => {
    const result = validateScenario({
      steps: [{
        view: "x",
        delayMs: 0,
        interactions: [{
          atPercent: 0.5,
          type: 4,
          target: "input",
          typeConfig: { text: "" },
        }],
      }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: "steps[0].interactions[0].typeConfig.text" }),
    );
  });

  it("rejects typeConfig with negative typeDelayMs", () => {
    const result = validateScenario({
      steps: [{
        view: "x",
        delayMs: 0,
        interactions: [{
          atPercent: 0.5,
          type: 4,
          target: "input",
          typeConfig: { text: "hello", typeDelayMs: -10 },
        }],
      }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: "steps[0].interactions[0].typeConfig.typeDelayMs" }),
    );
  });

  it("rejects hoverConfig with negative hoverDurationMs", () => {
    const result = validateScenario({
      steps: [{
        view: "x",
        delayMs: 0,
        interactions: [{
          atPercent: 0.5,
          type: 5,
          target: "btn",
          hoverConfig: { hoverDurationMs: -1 },
        }],
      }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: "steps[0].interactions[0].hoverConfig.hoverDurationMs" }),
    );
  });

  it("rejects drag action without dragConfig", () => {
    const result = validateScenario({
      steps: [{
        view: "x",
        delayMs: 0,
        interactions: [{
          atPercent: 0.5,
          type: 6,
          target: "source",
        }],
      }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        path: "steps[0].interactions[0].dragConfig",
        reason: expect.stringMatching(/required/),
      }),
    );
  });

  it("rejects dragConfig with empty dragTarget", () => {
    const result = validateScenario({
      steps: [{
        view: "x",
        delayMs: 0,
        interactions: [{
          atPercent: 0.5,
          type: 6,
          target: "source",
          dragConfig: { dragTarget: "" },
        }],
      }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: "steps[0].interactions[0].dragConfig.dragTarget" }),
    );
  });

  // --- Collects multiple errors ---

  it("collects multiple errors across steps and interactions", () => {
    const result = validateScenario({
      viewport: { width: -1, height: 0 },
      steps: [
        { view: "", delayMs: -1 },
        { delayMs: 0 },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });

  // --- Soundtrack ---

  it("accepts a valid soundtrack, including explicit 0.0 volumes", () => {
    const result = validateScenario({
      steps: [{ view: "x", delayMs: 0 }],
      soundtrack: {
        musicSrc: "./soundtrack/music.mp3",
        musicVolume: 0.25,
        duckingVolume: 0,
        sfx: true,
      },
    });
    expect(result.valid).toBe(true);
  });

  it("accepts a soundtrack with only sfx (no music)", () => {
    const result = validateScenario({
      steps: [{ view: "x", delayMs: 0 }],
      soundtrack: { sfx: true },
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a non-object soundtrack", () => {
    const result = validateScenario({
      steps: [{ view: "x", delayMs: 0 }],
      soundtrack: "music.mp3",
    });
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: "soundtrack" }),
    );
  });

  it("rejects an empty musicSrc", () => {
    const result = validateScenario({
      steps: [{ view: "x", delayMs: 0 }],
      soundtrack: { musicSrc: "" },
    });
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: "soundtrack.musicSrc" }),
    );
  });

  it.each([
    ["musicVolume above 1", { musicVolume: 1.2 }, "soundtrack.musicVolume"],
    ["musicVolume negative", { musicVolume: -0.1 }, "soundtrack.musicVolume"],
    ["musicVolume non-numeric", { musicVolume: "loud" }, "soundtrack.musicVolume"],
    ["duckingVolume above 1", { duckingVolume: 2 }, "soundtrack.duckingVolume"],
  ])("rejects %s", (_name, soundtrack, expectedPath) => {
    const result = validateScenario({
      steps: [{ view: "x", delayMs: 0 }],
      soundtrack,
    });
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: expectedPath }),
    );
  });

  it("rejects a non-boolean sfx", () => {
    const result = validateScenario({
      steps: [{ view: "x", delayMs: 0 }],
      soundtrack: { sfx: "yes" },
    });
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: "soundtrack.sfx" }),
    );
  });

  it("accepts valid title cards, one-sided or both", () => {
    for (const titleCards of [
      { intro: { title: "Acme", subtitle: "Fast", logoSrc: "./logo.png" } },
      { outro: { title: "Try it", ctaText: "acme.dev", durationMs: 4000 } },
      { intro: { title: "Acme" }, outro: { title: "Bye" } },
    ]) {
      const result = validateScenario({
        steps: [{ view: "x", delayMs: 0 }],
        titleCards,
      });
      expect(result.valid).toBe(true);
    }
  });

  it("rejects a non-object titleCards", () => {
    const result = validateScenario({
      steps: [{ view: "x", delayMs: 0 }],
      titleCards: "intro",
    });
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: "titleCards" }),
    );
  });

  it.each([
    ["a missing title", { intro: {} }, "titleCards.intro.title"],
    ["an empty title", { outro: { title: "" } }, "titleCards.outro.title"],
    ["an empty subtitle", { intro: { title: "T", subtitle: "" } }, "titleCards.intro.subtitle"],
    ["an empty logoSrc", { intro: { title: "T", logoSrc: "" } }, "titleCards.intro.logoSrc"],
    ["an empty ctaText", { outro: { title: "T", ctaText: "" } }, "titleCards.outro.ctaText"],
    ["a zero durationMs", { intro: { title: "T", durationMs: 0 } }, "titleCards.intro.durationMs"],
    [
      "a negative durationMs",
      { intro: { title: "T", durationMs: -100 } },
      "titleCards.intro.durationMs",
    ],
  ])("rejects a card with %s", (_name, titleCards, expectedPath) => {
    const result = validateScenario({
      steps: [{ view: "x", delayMs: 0 }],
      titleCards,
    });
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: expectedPath }),
    );
  });
});
