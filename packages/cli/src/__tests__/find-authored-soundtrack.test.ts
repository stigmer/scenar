import { describe, expect, it } from "vitest";
import { findAuthoredSoundtrack } from "../util/load-ts.js";

const STEPS = [{ delayMs: 0 }, { delayMs: 1500 }];
const SOUNDTRACK = { musicSrc: "./soundtrack/music.mp3", musicVolume: 0.3, sfx: true };

describe("findAuthoredSoundtrack", () => {
  it("finds the soundtrack riding a scenario-shaped export (createScenario)", () => {
    const exports = {
      default: { soundtrack: SOUNDTRACK, views: {}, steps: STEPS },
    };
    expect(findAuthoredSoundtrack(exports)).toEqual(SOUNDTRACK);
  });

  it("finds a bare `soundtrack` named export (directory-form authoring)", () => {
    const exports = { steps: STEPS, soundtrack: SOUNDTRACK };
    expect(findAuthoredSoundtrack(exports)).toEqual(SOUNDTRACK);
  });

  it("prefers the scenario-shaped export over a bare named export", () => {
    const exports = {
      default: { soundtrack: SOUNDTRACK, steps: STEPS },
      soundtrack: { musicSrc: "./other.mp3" },
    };
    expect(findAuthoredSoundtrack(exports)).toEqual(SOUNDTRACK);
  });

  it("returns null when the module authors no soundtrack", () => {
    expect(findAuthoredSoundtrack({ steps: STEPS })).toBeNull();
    expect(findAuthoredSoundtrack({})).toBeNull();
  });

  it("ignores a soundtrack on an object that carries no steps", () => {
    const exports = {
      config: { soundtrack: SOUNDTRACK },
      steps: STEPS,
    };
    expect(findAuthoredSoundtrack(exports)).toBeNull();
  });

  it("copies only the known soundtrack fields", () => {
    const exports = {
      steps: STEPS,
      soundtrack: { ...SOUNDTRACK, stray: "ignored" },
    };
    expect(findAuthoredSoundtrack(exports)).toEqual(SOUNDTRACK);
  });

  it("rejects non-object soundtrack exports", () => {
    expect(findAuthoredSoundtrack({ steps: STEPS, soundtrack: "music.mp3" })).toBeNull();
    expect(findAuthoredSoundtrack({ steps: STEPS, soundtrack: ["music.mp3"] })).toBeNull();
    expect(findAuthoredSoundtrack({ steps: STEPS, soundtrack: null })).toBeNull();
  });
});
