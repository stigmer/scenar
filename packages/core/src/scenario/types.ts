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
  /**
   * Narration script for this step. Consumed by `scenar narrate` to
   * produce audio files, and rendered at runtime as the step's caption
   * when the player has captions enabled (a presentation preference —
   * the `captions` player prop, the `?captions=1` embed param, or
   * `scenar render --captions`). Steps without narration play
   * uncaptioned.
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
  /**
   * Names this step as a still-capture point for `scenar shoot`.
   *
   * The capture happens at the step's settled *end* — after every
   * interaction (and its tail: click dispatch, per-char typing, camera
   * tween) has fired — so a shot-bearing step's duration must fit its
   * interaction tails.
   *
   * Shots are addressed by this name, never by step index, so inserting a
   * beat into a scenario never renumbers existing docs references. Names
   * must be unique within a scenario and kebab-case
   * (`^[a-z0-9]+(-[a-z0-9]+)*$`) — each becomes a filename
   * (`stills/<shot>.<theme>.png`) and a URL segment in the deployed
   * bundle. Steps without a `shot` are simply walked through.
   */
  readonly shot?: string;
}
