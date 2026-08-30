import { describe, expect, it } from "vitest";
import type { NarrationManifest } from "../narration/types.js";
import type { PresenterManifest } from "../presenter/types.js";
import { FINAL_DWELL_MS, computeStepTimeline } from "../timeline/compute-step-timeline.js";
import { deriveStepFromTime } from "../timeline/derive-step.js";
import { applyTitleCards } from "./apply-title-cards.js";
import { TITLE_CARD_DURATION_DEFAULT_MS } from "./title-cards.js";
import type { ScenarioStep } from "./types.js";

interface Data {
  screen: string;
}

const step = (delayMs: number, screen: string): ScenarioStep<Data> => ({
  delayMs,
  data: { screen },
});

const authored: ScenarioStep<Data>[] = [step(0, "login"), step(1500, "dashboard")];

const manifest: NarrationManifest = {
  steps: [
    { src: "./step-0.mp3", durationMs: 2000 },
    { src: "./step-1.mp3", durationMs: 1200 },
  ],
};

describe("applyTitleCards", () => {
  describe("no-op cases", () => {
    it("returns the inputs untouched when titleCards is undefined", () => {
      const result = applyTitleCards(authored, manifest, undefined);
      expect(result.steps).toBe(authored);
      expect(result.narrationManifest).toBe(manifest);
    });

    it("returns the inputs untouched when neither intro nor outro is set", () => {
      const result = applyTitleCards(authored, manifest, {});
      expect(result.steps).toBe(authored);
      expect(result.narrationManifest).toBe(manifest);
    });
  });

  describe("intro", () => {
    it("prepends an intro card step with the card content", () => {
      const { steps } = applyTitleCards(authored, undefined, {
        intro: { title: "Acme", subtitle: "Ship fast", logoSrc: "./logo.png" },
      });
      expect(steps).toHaveLength(3);
      expect(steps[0]!.delayMs).toBe(0);
      expect(steps[0]!.card).toEqual({
        kind: "intro",
        title: "Acme",
        subtitle: "Ship fast",
        logoSrc: "./logo.png",
      });
    });

    it("encodes the card duration as the following step's transition delay", () => {
      const { steps } = applyTitleCards(authored, undefined, {
        intro: { title: "Acme", durationMs: 4500 },
      });
      expect(steps[1]!.delayMs).toBe(4500);
      expect(steps[1]!.data).toEqual({ screen: "login" });
    });

    it("defaults the card duration when unset", () => {
      const { steps } = applyTitleCards(authored, undefined, { intro: { title: "Acme" } });
      expect(steps[1]!.delayMs).toBe(TITLE_CARD_DURATION_DEFAULT_MS);
    });

    it("keeps a larger authored first-step delay over the card duration", () => {
      const slowStart = [step(8000, "login"), step(1500, "dashboard")];
      const { steps } = applyTitleCards(slowStart, undefined, {
        intro: { title: "Acme", durationMs: 3000 },
      });
      expect(steps[1]!.delayMs).toBe(8000);
    });

    it("pads the narration manifest with a leading null", () => {
      const { narrationManifest } = applyTitleCards(authored, manifest, {
        intro: { title: "Acme" },
      });
      expect(narrationManifest!.steps).toEqual([null, ...manifest.steps]);
    });

    it("leaves an absent manifest absent", () => {
      const { narrationManifest } = applyTitleCards(authored, undefined, {
        intro: { title: "Acme" },
      });
      expect(narrationManifest).toBeUndefined();
    });

    it("does not prepend a card to an empty steps array", () => {
      const { steps } = applyTitleCards<Data>([], undefined, { intro: { title: "Acme" } });
      expect(steps).toHaveLength(0);
    });
  });

  describe("outro", () => {
    it("appends an outro card step that preserves the last authored step's dwell", () => {
      const { steps } = applyTitleCards(authored, undefined, {
        outro: { title: "Try it", ctaText: "acme.dev" },
      });
      expect(steps).toHaveLength(3);
      const outro = steps[2]!;
      expect(outro.delayMs).toBe(FINAL_DWELL_MS);
      expect(outro.card).toEqual({ kind: "outro", title: "Try it", ctaText: "acme.dev" });
    });

    it("clears the cursor and resets the viewport at card entry", () => {
      const { steps } = applyTitleCards(authored, undefined, { outro: { title: "Try it" } });
      expect(steps[2]!.interactions).toEqual([
        { atPercent: 0, type: "clear_cursor" },
        { atPercent: 0, type: "viewport_transition", viewportReset: true },
      ]);
    });

    it("pads the narration manifest with a trailing null", () => {
      const { narrationManifest } = applyTitleCards(authored, manifest, {
        outro: { title: "Try it" },
      });
      expect(narrationManifest!.steps).toEqual([...manifest.steps, null]);
    });
  });

  describe("intro and outro together", () => {
    it("frames the authored steps and pads the manifest on both ends", () => {
      const { steps, narrationManifest } = applyTitleCards(authored, manifest, {
        intro: { title: "Acme" },
        outro: { title: "Try it" },
      });
      expect(steps).toHaveLength(4);
      expect(steps[0]!.card?.kind).toBe("intro");
      expect(steps[1]!.data).toEqual({ screen: "login" });
      expect(steps[2]!.data).toEqual({ screen: "dashboard" });
      expect(steps[3]!.card?.kind).toBe("outro");
      expect(narrationManifest!.steps).toEqual([null, ...manifest.steps, null]);
    });

    it("copies only known card fields from a loosely-typed config", () => {
      const stray = {
        title: "Acme",
        clickHandler: () => {},
      } as unknown as { title: string };
      const { steps } = applyTitleCards(authored, undefined, { intro: stray });
      expect(steps[0]!.card).toEqual({ kind: "intro", title: "Acme" });
    });

    it("does not mutate the input steps or manifest", () => {
      const stepsBefore = [...authored];
      const manifestBefore = [...manifest.steps];
      applyTitleCards(authored, manifest, {
        intro: { title: "Acme" },
        outro: { title: "Try it" },
      });
      expect(authored).toEqual(stepsBefore);
      expect(manifest.steps).toEqual(manifestBefore);
    });
  });

  describe("presenter manifest padding", () => {
    const presenterManifest: PresenterManifest = {
      steps: [{ src: "./step-0.mp4", durationMs: 2000 }, null],
    };

    it("pads narration and presenter manifests at identical positions", () => {
      const result = applyTitleCards(authored, manifest, {
        intro: { title: "Acme" },
        outro: { title: "Try it" },
      }, presenterManifest);

      expect(result.narrationManifest!.steps).toEqual([null, ...manifest.steps, null]);
      expect(result.presenterManifest!.steps).toEqual([
        null,
        ...presenterManifest.steps,
        null,
      ]);
      // Index-aligned by construction: same length as the expanded steps.
      expect(result.presenterManifest!.steps).toHaveLength(result.steps.length);
      expect(result.narrationManifest!.steps).toHaveLength(result.steps.length);
    });

    it("returns the presenter manifest untouched when no card is configured", () => {
      const result = applyTitleCards(authored, manifest, undefined, presenterManifest);
      expect(result.presenterManifest).toBe(presenterManifest);
    });

    it("leaves an absent presenter manifest absent", () => {
      const result = applyTitleCards(authored, manifest, { intro: { title: "Acme" } });
      expect(result.presenterManifest).toBeUndefined();
    });

    it("pads the presenter manifest even when narration is absent", () => {
      const result = applyTitleCards(authored, undefined, {
        outro: { title: "Try it" },
      }, presenterManifest);
      expect(result.narrationManifest).toBeUndefined();
      expect(result.presenterManifest!.steps).toEqual([...presenterManifest.steps, null]);
    });

    it("does not mutate the input presenter manifest", () => {
      const entriesBefore = [...presenterManifest.steps];
      applyTitleCards(authored, manifest, {
        intro: { title: "Acme" },
        outro: { title: "Try it" },
      }, presenterManifest);
      expect(presenterManifest.steps).toEqual(entriesBefore);
    });
  });

  describe("timeline integration", () => {
    it("gives the intro exactly its duration and the outro exactly its dwell", () => {
      const { steps, narrationManifest } = applyTitleCards(authored, manifest, {
        intro: { title: "Acme", durationMs: 4000 },
        outro: { title: "Try it", durationMs: 5000 },
      });
      const tl = computeStepTimeline(steps, narrationManifest);
      // Intro visible 0..4000 (card duration beats step-0 narration? No —
      // the manifest is padded, so the intro has no narration entry).
      expect(tl.stepStartTimesMs).toEqual([
        0,
        4000, // login enters after the intro's 4000ms
        4000 + 2000, // dashboard after max(1500, login narration 2000)
        6000 + Math.max(FINAL_DWELL_MS, 1200), // outro after the authored closing dwell
      ]);
      // The outro dwells for its configured 5000ms.
      expect(tl.totalDurationMs).toBe(9000 + 5000);
    });

    it("changes nothing about the authored steps' relative timing", () => {
      const bare = computeStepTimeline(authored, manifest);
      const { steps, narrationManifest } = applyTitleCards(authored, manifest, {
        intro: { title: "Acme" },
      });
      const framed = computeStepTimeline(steps, narrationManifest);
      // Every authored boundary shifts by exactly the intro duration.
      const shifted = bare.stepStartTimesMs.map((ms) => ms + TITLE_CARD_DURATION_DEFAULT_MS);
      expect(framed.stepStartTimesMs.slice(1)).toEqual(shifted);
      expect(framed.totalDurationMs).toBe(bare.totalDurationMs + TITLE_CARD_DURATION_DEFAULT_MS);
    });

    it("derives the same active step in both time domains across card boundaries", () => {
      const fps = 30;
      const msToFrame = (ms: number) => Math.round((ms * fps) / 1000);
      const frameToMs = (frame: number) => (frame * 1000) / fps;

      const { steps, narrationManifest } = applyTitleCards(authored, manifest, {
        intro: { title: "Acme" },
        outro: { title: "Try it" },
      });
      const tl = computeStepTimeline(steps, narrationManifest);
      const lastIndex = steps.length - 1;

      // Sample densely around every boundary plus mid-step points.
      const samples = tl.stepStartTimesMs.flatMap((ms) => [ms - 34, ms, ms + 34]);
      samples.push(tl.totalDurationMs - 34, tl.totalDurationMs);
      for (const t of samples.filter((ms) => ms >= 0)) {
        const browserStep = deriveStepFromTime(t, tl.stepStartTimesMs, lastIndex);
        const frameStep = deriveStepFromTime(
          frameToMs(msToFrame(t)),
          tl.stepStartTimesMs,
          lastIndex,
        );
        expect(frameStep).toBe(browserStep);
      }
    });
  });
});
