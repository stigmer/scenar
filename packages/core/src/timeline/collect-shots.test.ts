import { describe, expect, it } from "vitest";
import { computeStepTimeline } from "./compute-step-timeline.js";
import { SHOT_NAME_PATTERN, collectScenarioShots, collectShotNames } from "./collect-shots.js";

describe("collectScenarioShots", () => {
  it("resolves each shot to the settled end of its step", () => {
    const steps = [
      { delayMs: 0, shot: "opening" },
      { delayMs: 1000 },
      { delayMs: 2000, shot: "detail-open" },
    ];
    const timeline = computeStepTimeline(steps, null);
    // Starts: [0, 1000, 3000]; total: 3000 + 3000 (final dwell).
    expect(collectScenarioShots(steps, timeline)).toEqual([
      { name: "opening", timeMs: 999, stepIndex: 0 },
      { name: "detail-open", timeMs: 5999, stepIndex: 2 },
    ]);
  });

  it("places a final-step shot inside the final dwell", () => {
    const steps = [{ delayMs: 0 }, { delayMs: 500, shot: "finale" }];
    const timeline = computeStepTimeline(steps, null);
    expect(collectScenarioShots(steps, timeline)).toEqual([
      { name: "finale", timeMs: timeline.totalDurationMs - 1, stepIndex: 1 },
    ]);
  });

  it("resolves shot times against narration-driven step durations", () => {
    const steps = [{ delayMs: 0, shot: "narrated" }, { delayMs: 500 }];
    const timeline = computeStepTimeline(steps, {
      steps: [{ src: "a.mp3", durationMs: 4000 }, null],
    });
    // Step 1 starts at max(500, 4000) = 4000; the shot lands just before it.
    expect(collectScenarioShots(steps, timeline)).toEqual([
      { name: "narrated", timeMs: 3999, stepIndex: 0 },
    ]);
  });

  it("returns an empty list when no step declares a shot", () => {
    const steps = [{ delayMs: 0 }, { delayMs: 1000 }];
    expect(collectScenarioShots(steps, computeStepTimeline(steps, null))).toEqual([]);
  });

  it("rejects a non-kebab-case name, naming the step", () => {
    const steps = [{ delayMs: 0 }, { delayMs: 100, shot: "Detail_Open" }];
    expect(() =>
      collectScenarioShots(steps, computeStepTimeline(steps, null)),
    ).toThrowError(/step 1 declares shot "Detail_Open"/);
  });

  it.each(["-leading", "trailing-", "double--dash", "UPPER", "with.dot", "with space", ""])(
    'rejects invalid shot name "%s"',
    (name) => {
      const steps = [{ delayMs: 0, shot: name }];
      expect(() =>
        collectScenarioShots(steps, computeStepTimeline(steps, null)),
      ).toThrowError(/not kebab-case/);
    },
  );

  it.each(["a", "shot-1", "agent-detail", "step2-open"])(
    'accepts valid shot name "%s"',
    (name) => {
      expect(SHOT_NAME_PATTERN.test(name)).toBe(true);
    },
  );

  it("rejects duplicate names, naming both steps", () => {
    const steps = [
      { delayMs: 0, shot: "opening" },
      { delayMs: 100 },
      { delayMs: 100, shot: "opening" },
    ];
    expect(() =>
      collectScenarioShots(steps, computeStepTimeline(steps, null)),
    ).toThrowError(/steps 0 and 2 both declare shot "opening"/);
  });
});

describe("collectShotNames", () => {
  it("returns the declared names in step order, without needing a timeline", () => {
    const steps = [
      { delayMs: 0, shot: "opening" },
      { delayMs: 1000 },
      { delayMs: 2000, shot: "detail-open" },
    ];
    expect(collectShotNames(steps)).toEqual(["opening", "detail-open"]);
  });

  it("returns an empty list when no step declares a shot", () => {
    expect(collectShotNames([{ delayMs: 0 }, { delayMs: 1000 }])).toEqual([]);
  });

  it("throws the same validation errors as collectScenarioShots", () => {
    expect(() => collectShotNames([{ delayMs: 0, shot: "Not_Kebab" }])).toThrowError(
      /not kebab-case/,
    );
    expect(() =>
      collectShotNames([
        { delayMs: 0, shot: "opening" },
        { delayMs: 100, shot: "opening" },
      ]),
    ).toThrowError(/steps 0 and 1 both declare shot "opening"/);
  });

  it("agrees with collectScenarioShots on every valid scenario (shared walk)", () => {
    const steps = [
      { delayMs: 0, shot: "opening" },
      { delayMs: 500 },
      { delayMs: 700, shot: "midway" },
      { delayMs: 300, shot: "finale" },
    ];
    const resolved = collectScenarioShots(steps, computeStepTimeline(steps, null));
    expect(collectShotNames(steps)).toEqual(resolved.map((shot) => shot.name));
  });
});
