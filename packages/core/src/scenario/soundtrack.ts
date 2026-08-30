/**
 * The scenario's audio treatment beyond narration: optional background
 * music with narration ducking, and optional interaction sound effects.
 *
 * Runtime mirror of the proto `SoundtrackConfig` (`ai.scenar.scenario.v1`),
 * field for field, in camelCase — the same 1:1 relationship `StepAction`
 * has with its proto message. Music and sound effects are independent:
 * a scenario may use either without the other.
 */
export interface Soundtrack {
  /**
   * Background music asset reference. Like narration clip srcs, a
   * relative path resolves against the scenario's own location; an
   * absolute URL passes through unchanged. MP3 is the supported format.
   * When `undefined`, the scenario has no music.
   */
  readonly musicSrc?: string;
  /**
   * Base music level while no narration is playing (0–1).
   * Defaults to {@link MUSIC_VOLUME_DEFAULT}.
   */
  readonly musicVolume?: number;
  /**
   * Absolute music level while a narration clip plays (0–1) — the level
   * the music ducks to, not a multiplier of {@link musicVolume}.
   * Defaults to {@link DUCKING_VOLUME_DEFAULT}.
   */
  readonly duckingVolume?: number;
  /**
   * Enables the engine's built-in interaction sound effects (click and
   * keystroke). Requires an explicit `true` — adding music alone never
   * introduces sound effects.
   */
  readonly sfx?: boolean;
}

/**
 * Default base music level. Clearly audible under silence without
 * competing with interface sound effects.
 */
export const MUSIC_VOLUME_DEFAULT = 0.25;

/**
 * Default ducked music level while narration plays. Present but firmly
 * under the voice.
 */
export const DUCKING_VOLUME_DEFAULT = 0.08;
