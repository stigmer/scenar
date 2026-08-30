import { describe, expect, it } from "vitest";
import type { NarrationManifest } from "../narration/types.js";
import { MUSIC_VOLUME_DEFAULT, DUCKING_VOLUME_DEFAULT } from "../scenario/soundtrack.js";
import {
  DUCKING_RAMP_MS,
  MUSIC_FADE_IN_MS,
  MUSIC_FADE_OUT_MS,
  computeMusicEnvelope,
  musicGainAt,
} from "./music-envelope.js";

/**
 * Two steps: step 0 narrated for 5 s, step 1 silent. Timeline:
 * step 0 at 0, step 1 at 5000 (narration outlasts its 1000 delay),
 * total 5000 + FINAL_DWELL(3000) = 8000. Ducking window [0, 5000].
 */
const STEPS = [{ delayMs: 0 }, { delayMs: 1000 }];
const MANIFEST: NarrationManifest = {
  steps: [{ src: "./step-0.mp3", durationMs: 5000 }, null],
};

describe("computeMusicEnvelope", () => {
  it("derives one ducking window per narrated step from the shared timeline", () => {
    const envelope = computeMusicEnvelope(STEPS, MANIFEST, {});
    expect(envelope.duckingWindows).toEqual([{ startMs: 0, endMs: 5000 }]);
    expect(envelope.totalDurationMs).toBe(8000);
  });

  it("resolves unset volumes to the engine defaults", () => {
    const envelope = computeMusicEnvelope(STEPS, MANIFEST, {});
    expect(envelope.musicVolume).toBe(MUSIC_VOLUME_DEFAULT);
    expect(envelope.duckingVolume).toBe(DUCKING_VOLUME_DEFAULT);
  });

  it("honors explicit volumes, including 0.0", () => {
    const envelope = computeMusicEnvelope(STEPS, MANIFEST, {
      musicVolume: 0.6,
      duckingVolume: 0,
    });
    expect(envelope.musicVolume).toBe(0.6);
    expect(envelope.duckingVolume).toBe(0);
  });

  it("no narration manifest means no ducking windows", () => {
    const envelope = computeMusicEnvelope(STEPS, undefined, {});
    expect(envelope.duckingWindows).toEqual([]);
  });

  it("skips zero-duration narration entries", () => {
    const manifest: NarrationManifest = {
      steps: [{ src: "./step-0.mp3", durationMs: 0 }, null],
    };
    expect(computeMusicEnvelope(STEPS, manifest, {}).duckingWindows).toEqual([]);
  });
});

describe("musicGainAt", () => {
  // A silent-scenario envelope isolates fades from ducking:
  // no manifest, total 1000(delay) + 3000(dwell) = 4000.
  const noDuckEnvelope = computeMusicEnvelope(STEPS, undefined, { musicVolume: 0.5 });

  it("is 0 outside the scenario", () => {
    expect(musicGainAt(noDuckEnvelope, -1)).toBe(0);
    expect(musicGainAt(noDuckEnvelope, noDuckEnvelope.totalDurationMs + 1)).toBe(0);
  });

  it("fades in from silence to the base level", () => {
    expect(musicGainAt(noDuckEnvelope, 0)).toBe(0);
    expect(musicGainAt(noDuckEnvelope, MUSIC_FADE_IN_MS / 2)).toBeCloseTo(0.25, 10);
    expect(musicGainAt(noDuckEnvelope, MUSIC_FADE_IN_MS)).toBeCloseTo(0.5, 10);
  });

  it("fades out to silence over the closing window", () => {
    const total = noDuckEnvelope.totalDurationMs;
    expect(musicGainAt(noDuckEnvelope, total - MUSIC_FADE_OUT_MS / 2)).toBeCloseTo(0.25, 10);
    expect(musicGainAt(noDuckEnvelope, total)).toBe(0);
  });

  it("holds the base level on the plateau between fades", () => {
    expect(musicGainAt(noDuckEnvelope, 1000)).toBeCloseTo(0.5, 10);
  });

  // Ducking assertions use a window clear of both fades: step 1 narrated
  // 2000 → window [4000, 6000]; the trailing 8000-delay step pushes the
  // total to 15000, so the fade-out ([12000, 15000]) can't overlap it.
  const duckSteps = [{ delayMs: 0 }, { delayMs: 4000 }, { delayMs: 8000 }];
  const duckManifest: NarrationManifest = {
    steps: [null, { src: "./step-1.mp3", durationMs: 2000 }, null],
  };
  const duckEnvelope = computeMusicEnvelope(duckSteps, duckManifest, {
    musicVolume: 0.5,
    duckingVolume: 0.1,
  });

  it("is fully ducked while the narration clip plays", () => {
    expect(musicGainAt(duckEnvelope, 4000)).toBeCloseTo(0.1, 10);
    expect(musicGainAt(duckEnvelope, 5000)).toBeCloseTo(0.1, 10);
    expect(musicGainAt(duckEnvelope, 6000)).toBeCloseTo(0.1, 10);
  });

  it("completes the down-ramp at voice onset (pre-duck)", () => {
    const rampStart = 4000 - DUCKING_RAMP_MS;
    expect(musicGainAt(duckEnvelope, rampStart)).toBeCloseTo(0.5, 10);
    expect(musicGainAt(duckEnvelope, rampStart + DUCKING_RAMP_MS / 2)).toBeCloseTo(0.3, 10);
  });

  it("ramps back to the base level after the clip ends", () => {
    expect(musicGainAt(duckEnvelope, 6000 + DUCKING_RAMP_MS / 2)).toBeCloseTo(0.3, 10);
    expect(musicGainAt(duckEnvelope, 6000 + DUCKING_RAMP_MS)).toBeCloseTo(0.5, 10);
  });

  it("overlapping windows take the deepest duck", () => {
    // Two narrated steps whose windows adjoin: the boundary sample sits in
    // window 0's up-ramp AND window 1's plateau — the plateau (deeper) wins.
    const steps = [{ delayMs: 0 }, { delayMs: 0 }, { delayMs: 4000 }];
    const manifest: NarrationManifest = {
      steps: [
        { src: "./step-0.mp3", durationMs: 3000 },
        { src: "./step-1.mp3", durationMs: 3000 },
        null,
      ],
    };
    const envelope = computeMusicEnvelope(steps, manifest, {
      musicVolume: 0.5,
      duckingVolume: 0.1,
    });
    // Windows: [0, 3000] and [3000, 6000] — inside window 0's up-ramp zone.
    expect(musicGainAt(envelope, 3000 + DUCKING_RAMP_MS / 2)).toBeCloseTo(0.1, 10);
  });

  it("a ducking window during the fade-in multiplies both factors", () => {
    // duckEnvelope's fade-in covers [0, 1000]; window starts at 4000 — use
    // an envelope whose narration starts at 0 instead.
    const envelope = computeMusicEnvelope(STEPS, MANIFEST, {
      musicVolume: 0.5,
      duckingVolume: 0.1,
    });
    // At 500ms: ducked level 0.1 × fade-in factor 0.5.
    expect(musicGainAt(envelope, MUSIC_FADE_IN_MS / 2)).toBeCloseTo(0.05, 10);
  });
});
