import { describe, expect, it } from "vitest";
import { findAuthoredTitleCards } from "../util/load-ts.js";

const STEPS = [{ delayMs: 0 }, { delayMs: 1500 }];
const TITLE_CARDS = {
  intro: { title: "Acme Deploy", subtitle: "Ship in seconds", logoSrc: "./logo.png" },
  outro: { title: "Try it today", ctaText: "acme.dev/start", durationMs: 4000 },
};

describe("findAuthoredTitleCards", () => {
  it("finds title cards riding a scenario-shaped export (createScenario)", () => {
    const exports = {
      default: { titleCards: TITLE_CARDS, views: {}, steps: STEPS },
    };
    expect(findAuthoredTitleCards(exports)).toEqual(TITLE_CARDS);
  });

  it("finds a bare `titleCards` named export (directory-form authoring)", () => {
    const exports = { steps: STEPS, titleCards: TITLE_CARDS };
    expect(findAuthoredTitleCards(exports)).toEqual(TITLE_CARDS);
  });

  it("prefers the scenario-shaped export over a bare named export", () => {
    const exports = {
      default: { titleCards: TITLE_CARDS, steps: STEPS },
      titleCards: { intro: { title: "Other" } },
    };
    expect(findAuthoredTitleCards(exports)).toEqual(TITLE_CARDS);
  });

  it("returns null when the module authors no title cards", () => {
    expect(findAuthoredTitleCards({ steps: STEPS })).toBeNull();
    expect(findAuthoredTitleCards({})).toBeNull();
  });

  it("ignores title cards on an object that carries no steps", () => {
    const exports = {
      config: { titleCards: TITLE_CARDS },
      steps: STEPS,
    };
    expect(findAuthoredTitleCards(exports)).toBeNull();
  });

  it("copies only the known card fields on each side", () => {
    const exports = {
      steps: STEPS,
      titleCards: {
        intro: { ...TITLE_CARDS.intro, stray: "ignored" },
        outro: { ...TITLE_CARDS.outro, onClick: () => {} },
      },
    };
    expect(findAuthoredTitleCards(exports)).toEqual(TITLE_CARDS);
  });

  it("keeps one-sided configs one-sided", () => {
    const exports = { steps: STEPS, titleCards: { outro: TITLE_CARDS.outro } };
    expect(findAuthoredTitleCards(exports)).toEqual({ outro: TITLE_CARDS.outro });
  });

  it("rejects non-object titleCards exports", () => {
    expect(findAuthoredTitleCards({ steps: STEPS, titleCards: "cards" })).toBeNull();
    expect(findAuthoredTitleCards({ steps: STEPS, titleCards: ["intro"] })).toBeNull();
    expect(findAuthoredTitleCards({ steps: STEPS, titleCards: null })).toBeNull();
  });
});
