/**
 * Common interface for text-to-speech providers.
 *
 * Each provider converts plain text into audio. The CLI resolves
 * which provider to use at runtime based on the `--tts` flag and
 * package availability.
 */
export interface TtsProvider {
  /** Human-readable name shown in logs and the narration manifest. */
  readonly name: string;

  /**
   * Cache identity: the provider name plus every piece of static
   * configuration that changes the audio bytes (model, default voice,
   * engine). The narration cache keys on this, so audio regenerates
   * whenever any of those inputs change — switching providers or models
   * must never serve stale audio from a previous configuration.
   * Per-call inputs (requested voice, text) are hashed separately.
   */
  readonly fingerprint: string;

  /**
   * Generate speech audio for the given text.
   * Returns the raw audio bytes and the audio duration.
   */
  synthesize(text: string, options: TtsOptions): Promise<TtsResult>;
}

export interface TtsOptions {
  /** Voice identifier (provider-specific). */
  voice?: string;
}

export interface TtsResult {
  /** Raw audio content (MP3). */
  audio: Buffer;
  /** Duration of the generated audio clip in milliseconds. */
  durationMs: number;
}

/**
 * @deprecated Legacy CLI manifest shape. The narrate command now writes
 * manifests matching `@scenar/core`'s `NarrationManifest` type directly
 * (positional array of `{ src, durationMs } | null`).
 *
 * Kept temporarily for test compatibility during the transition.
 */
export interface NarrationManifest {
  generatedAt: string;
  ttsProvider: string;
  steps: NarrationManifestStep[];
}

export interface NarrationManifestStep {
  index: number;
  file: string;
  durationMs: number;
  text: string;
}
