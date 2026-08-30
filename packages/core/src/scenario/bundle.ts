/**
 * A self-contained scenario package: steps + optional narration manifest.
 *
 * Replaces the pattern where scenario steps and narration manifests are
 * passed as separate, unrelated props and wired together by string
 * convention.  A bundle groups everything the engine needs to play a
 * scenario into a single typed value.
 */

import type { NarrationManifest } from "../narration/types.js";
import type { Soundtrack } from "./soundtrack.js";
import type { ScenarioStep } from "./types.js";

/**
 * Everything the engine needs to play one scenario.
 *
 * @typeParam T - The data shape passed to the render function at each step.
 */
export interface ScenarioBundle<T> {
  /** Unique identifier for this scenario (used for keying and diagnostics). */
  readonly id: string;
  /** Ordered steps in the playback timeline. */
  readonly steps: ScenarioStep<T>[];
  /**
   * Pre-built narration manifest mapping step indices to audio URLs
   * and durations.  When `undefined`, the scenario plays without
   * narration (timing is purely delay-based).
   */
  readonly narrationManifest?: NarrationManifest;
  /**
   * Audio treatment: background music with narration ducking and
   * interaction sound effects.  When `undefined`, the scenario plays
   * silent apart from narration.
   */
  readonly soundtrack?: Soundtrack;
}
