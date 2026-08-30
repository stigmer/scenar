/**
 * Runtime presenter clip data produced by `scenar presenter`.
 *
 * The presenter track is structurally a second narration pipeline:
 * generation happens at compile time (the CLI calls the avatar
 * provider once and stores the result), and playback consumes fixed
 * assets through a positional manifest. Playback never calls an AI
 * service — a scenario whose clips have not been generated yet simply
 * plays without the presenter.
 *
 * Deliberately its own type, not a generic "clip manifest" shared with
 * narration: the two are structurally identical today, but their doc
 * contracts differ, and that difference IS the domain knowledge.
 */

/** A single presenter clip for one scenario step. */
export interface PresenterEntry {
  /**
   * URL of the clip, relative to the manifest's own location
   * (e.g. "./step-2.mp4") — the same convention narration uses.
   */
  readonly src: string;
  /**
   * Duration of the clip in milliseconds. Written from the narration
   * manifest's duration for the same step (the clip is lip-synced to
   * that audio and matches it exactly), so presenter timing and
   * narration timing can never disagree.
   */
  readonly durationMs: number;
}

/**
 * Per-scenario manifest mapping step indices to presenter clips.
 *
 * Array position corresponds to the AUTHORED step index — like the
 * narration manifest, it never knows about synthesized title-card
 * steps. Bundle assembly (`applyTitleCards`) pads `null` entries at
 * injected card positions so the expanded manifest lines up with the
 * expanded steps; cards never show the presenter.
 *
 * Steps without a presenter (not opted in, or generation failed and
 * playback degrades per-step) use `null`.
 */
export interface PresenterManifest {
  readonly steps: readonly (PresenterEntry | null)[];
}
