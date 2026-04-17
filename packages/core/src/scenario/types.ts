/**
 * Core scenario data types.
 *
 * These types define the contract between scenario authors and the
 * playback engine. They are framework-agnostic — no React, no DOM.
 */

import type { StepAction } from "./step-action.js";

/**
 * A single step in a scenario timeline.
 *
 * @typeParam T - The data shape passed to the render function at this step.
 */
export interface ScenarioStep<T> {
  /** Milliseconds to wait before revealing this step. */
  readonly delayMs: number;
  /** Data snapshot at this point in the timeline. */
  readonly data: T;
  /** Short label shown below the demo content describing the current action. */
  readonly caption?: string;
  /**
   * Narration script for TTS generation. Consumed by the build script
   * to produce audio files — not rendered at runtime.
   */
  readonly narration?: string;
  /**
   * Timed interactions to execute while this step is active. Each
   * interaction fires at a specific point during the step's duration
   * (controlled by {@link StepAction.atPercent}).
   *
   * Interactions are executed in order. When multiple interactions
   * share the same atPercent, they fire in array order.
   */
  readonly interactions?: readonly StepAction[];
}
