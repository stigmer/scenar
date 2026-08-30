/**
 * Card synthesis: expand a scenario's steps (and narration manifest)
 * with its configured intro/outro title cards.
 *
 * This is THE one place card steps are constructed. It runs exactly
 * once per playback surface, at bundle assembly — the generated render
 * and pack entries, the CLI's `loadBundle`, and (for direct React
 * integrators) one documented call between `createScenario()` and the
 * player. Authoring surfaces (`createScenario`, `loadScenarioFromProto`)
 * carry the `titleCards` config through untouched, exactly like
 * `soundtrack` — so expanded output never carries the config and double
 * expansion is impossible by data flow.
 *
 * The narration manifest stays keyed to AUTHORED steps everywhere
 * (`scenar narrate` never sees cards); this function pads `null`
 * entries at the injected positions so the expanded manifest lines up
 * with the expanded steps. Existing manifests therefore stay valid when
 * an author adds cards later — no regeneration required.
 */

import type { NarrationManifest } from "../narration/types.js";
import { FINAL_DWELL_MS } from "../timeline/compute-step-timeline.js";
import type { ScenarioStep } from "./types.js";
import {
  TITLE_CARD_DURATION_DEFAULT_MS,
  type TitleCard,
  type TitleCards,
} from "./title-cards.js";

/** The result of card expansion: steps and manifest, index-aligned. */
export interface AppliedTitleCards<T> {
  readonly steps: readonly ScenarioStep<T>[];
  readonly narrationManifest: NarrationManifest | undefined;
}

/**
 * A card step's `data` placeholder. Card steps are rendered by the
 * player's built-in card component — the integrator's render callback
 * (the only reader of `data`) is never invoked for them, so no real
 * `T` value is ever needed. See the `ScenarioStep.card` doc contract.
 */
function cardStepData<T>(): T {
  return undefined as unknown as T;
}

/**
 * Expand `steps` (and the index-parallel narration manifest, when one
 * exists) with the configured intro/outro cards.
 *
 * - **Intro**: prepended at index 0 with `delayMs: 0`; the card's
 *   visible time is encoded as the following step's transition delay
 *   (`max(authored delayMs, card duration)`), which is exactly how
 *   `computeStepTimeline` reads step 0's duration.
 * - **Outro**: appended with `delayMs: FINAL_DWELL_MS`, so the last
 *   authored step keeps precisely the closing dwell it has today (or
 *   its narration, whichever is longer) before the card appears. The
 *   card's own visible time is its `durationMs` — `computeStepTimeline`
 *   reads a final card step's duration as the closing dwell. The outro
 *   carries two housekeeping interactions at step entry (`clear_cursor`
 *   and a viewport reset) so a scenario ending with a visible cursor or
 *   an active zoom never leaks that state onto the card. Neither action
 *   maps to a sound effect.
 *
 * Pure and non-mutating. When `titleCards` configures no card, the
 * inputs are returned as-is (byte-identical no-op).
 */
export function applyTitleCards<T>(
  steps: readonly ScenarioStep<T>[],
  narrationManifest: NarrationManifest | undefined,
  titleCards: TitleCards | undefined,
): AppliedTitleCards<T> {
  const intro = titleCards?.intro;
  const outro = titleCards?.outro;
  if (!intro && !outro) {
    return { steps, narrationManifest };
  }

  const expandedSteps: ScenarioStep<T>[] = [...steps];
  let manifestEntries = narrationManifest ? [...narrationManifest.steps] : undefined;

  if (intro && expandedSteps.length > 0) {
    const introDurationMs = intro.durationMs ?? TITLE_CARD_DURATION_DEFAULT_MS;
    const firstAuthored = expandedSteps[0]!;
    expandedSteps[0] = {
      ...firstAuthored,
      delayMs: Math.max(firstAuthored.delayMs, introDurationMs),
    };
    expandedSteps.unshift({
      delayMs: 0,
      data: cardStepData<T>(),
      card: { kind: "intro", ...pickCardContent(intro) },
    });
    manifestEntries?.unshift(null);
  }

  if (outro) {
    expandedSteps.push({
      delayMs: FINAL_DWELL_MS,
      data: cardStepData<T>(),
      card: { kind: "outro", ...pickCardContent(outro) },
      interactions: [
        { atPercent: 0, type: "clear_cursor" },
        { atPercent: 0, type: "viewport_transition", viewportReset: true },
      ],
    });
    manifestEntries?.push(null);
  }

  return {
    steps: expandedSteps,
    narrationManifest: manifestEntries ? { steps: manifestEntries } : undefined,
  };
}

/**
 * Copy only the known card fields, so a config object carrying strays
 * (e.g. a loosely-typed steps.ts export) never smuggles them into the
 * step list.
 */
function pickCardContent(card: TitleCard): TitleCard {
  const content: {
    title: string;
    subtitle?: string;
    logoSrc?: string;
    ctaText?: string;
    durationMs?: number;
  } = { title: card.title };
  if (card.subtitle !== undefined) content.subtitle = card.subtitle;
  if (card.logoSrc !== undefined) content.logoSrc = card.logoSrc;
  if (card.ctaText !== undefined) content.ctaText = card.ctaText;
  if (card.durationMs !== undefined) content.durationMs = card.durationMs;
  return content;
}
