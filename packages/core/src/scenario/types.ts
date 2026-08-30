/**
 * Core scenario data types.
 *
 * These types define the contract between scenario authors and the
 * playback engine. They are framework-agnostic — no React, no DOM.
 */

import type { StepAction } from "./step-action.js";
import type { StepCard } from "./title-cards.js";

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
   * Marks this step for the presenter track. When true, `scenar presenter`
   * generates an avatar clip lip-synced to this step's narration audio,
   * and both outputs show the clip picture-in-picture while the step is
   * active — the interactive embed and the exported video alike.
   *
   * Requires `narration`: the presenter clip is derived from the step's
   * narration audio by definition, so a step without narration cannot
   * opt in (validated at load time).
   *
   * Playback never calls an AI service. Like narration audio, presenter
   * clips are generated at compile time by the CLI and consumed as fixed
   * assets through a positional manifest; a scenario whose clips have
   * not been generated yet simply plays without the presenter.
   */
  readonly presenter?: boolean;
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
  /**
   * Marks this step as an engine-synthesized title card. Only
   * `applyTitleCards` constructs card steps — authors configure cards
   * through the scenario-level `titleCards` config, never by hand.
   *
   * The player renders card steps with its built-in card component and
   * never calls the scenario's render function for them, so a card
   * step's `data` is a placeholder that is never read. Card steps
   * announce activation through the player's `onCardStepChange`
   * callback instead of `onStepChange` — the engine cannot fabricate a
   * real `T` for the latter.
   */
  readonly card?: StepCard;
}
