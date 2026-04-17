/**
 * Core scenario data types.
 *
 * These types define the contract between scenario authors and the
 * playback engine. They are framework-agnostic — no React, no DOM.
 */

/**
 * A single step in a scenario timeline.
 *
 * @typeParam T - The data shape passed to the render function at this step.
 */
export interface ScenarioStep<T> {
  /** Milliseconds to wait before revealing this step. */
  delayMs: number;
  /** Data snapshot at this point in the timeline. */
  data: T;
  /** Short label shown below the demo content describing the current action. */
  caption?: string;
  /**
   * Narration script for TTS generation. Consumed by the build script
   * to produce audio files — not rendered at runtime.
   */
  narration?: string;
}
