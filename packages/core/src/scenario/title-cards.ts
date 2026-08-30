/**
 * Intro and outro title cards framing a scenario.
 *
 * Runtime mirror of the proto `TitleCardsConfig` / `TitleCard`
 * (`ai.scenar.scenario.v1`), field for field, in camelCase — the same
 * 1:1 relationship `Soundtrack` has with its proto message.
 *
 * Cards are synthesized steps: {@link applyTitleCards} injects them
 * into the step list at bundle assembly, so chapter markers, scrubbing,
 * video duration, and the music envelope account for them with no
 * card-specific timing code. The player renders card steps with its
 * built-in card component — the scenario's render function is never
 * called for them.
 */

/** One card's content — deliberately small; a card, not a page builder. */
export interface TitleCard {
  /** Headline text. The one required field. */
  readonly title: string;
  /** Supporting line rendered under the title. */
  readonly subtitle?: string;
  /**
   * Logo image asset reference. Like narration and music srcs, a
   * relative path resolves against the scenario's own location; an
   * absolute URL passes through unchanged. Raster web formats only
   * (png, jpg/jpeg, gif, webp, avif) — the deploy contract excludes
   * svg as active content.
   */
  readonly logoSrc?: string;
  /**
   * Call-to-action text rendered as a distinct pill. Display-only —
   * not a link. Typically used on the outro.
   */
  readonly ctaText?: string;
  /**
   * How long the card stays on screen, in milliseconds.
   * Defaults to {@link TITLE_CARD_DURATION_DEFAULT_MS}.
   */
  readonly durationMs?: number;
}

/**
 * The scenario-level card configuration: an intro card, an outro card,
 * or both. Either field may be set independently; neither set is a no-op.
 */
export interface TitleCards {
  /** Opening card shown before the first authored step. */
  readonly intro?: TitleCard;
  /** Closing card shown after the last authored step. */
  readonly outro?: TitleCard;
}

/**
 * The card marker carried by a synthesized card step
 * ({@link ScenarioStep.card}). `kind` records which side of the
 * scenario the card frames so the renderer can style intro and outro
 * distinctly if it chooses.
 */
export interface StepCard extends TitleCard {
  readonly kind: "intro" | "outro";
}

/**
 * Default card visible time. Long enough to read a title and subtitle,
 * short enough to not delay the content.
 */
export const TITLE_CARD_DURATION_DEFAULT_MS = 3_000;
