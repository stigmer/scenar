import type { TtsProvider, TtsOptions, TtsResult } from "./types.js";

const ENGINE = "vits";

/**
 * Requested MP3 bitrate — the mono-speech standard (OpenAI's tts-1
 * emits ~64 kbps MP3 too). The bitrate doubles as the fallback duration
 * estimate when the synthesis timeline is unavailable.
 */
const OUTPUT_BITRATE_KBPS = 64;

/**
 * Checks whether the `echogarden` package is available at runtime.
 * Returns `true` if it can be imported, `false` otherwise.
 */
export async function isEchogardenAvailable(): Promise<boolean> {
  try {
    await import("echogarden");
    return true;
  } catch {
    return false;
  }
}

/**
 * TTS provider backed by Echogarden — a TypeScript-native, offline
 * speech toolkit. Requires no API keys or network access.
 *
 * Echogarden is an **optional peer dependency** (GPL v3 licensed).
 * Users must install it explicitly: `pnpm add echogarden`.
 *
 * Uses dynamic import to avoid compile-time type coupling to the
 * optional dependency.
 *
 * MP3 encoding happens inside `synthesize` via the `outputAudioFormat`
 * option — echogarden 2.x has no standalone encode export (the removal
 * of `encodeRawAudioToMp3` is what broke this provider once, see
 * issue #19; the export-surface smoke test in
 * `__tests__/echogarden-provider.test.ts` guards against a repeat).
 */
export function createEchogardenProvider(): TtsProvider {
  return {
    name: "echogarden",
    // The output format is part of the cache identity: a codec or
    // bitrate change alters the audio bytes, so cached audio from a
    // different encoding configuration must regenerate.
    fingerprint: `echogarden/${ENGINE}/mp3-${OUTPUT_BITRATE_KBPS}`,

    async synthesize(text: string, options: TtsOptions): Promise<TtsResult> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let echogarden: any;
      try {
        echogarden = await import("echogarden");
      } catch {
        throw new Error(
          "Echogarden is not installed. Install it with:\n\n" +
          "  pnpm add echogarden\n\n" +
          "Or use a different TTS provider: --tts edge-tts, --tts openai, --tts elevenlabs",
        );
      }

      const result = await echogarden.synthesize(text, {
        engine: ENGINE,
        voice: options.voice,
        outputAudioFormat: { codec: "mp3", bitrate: OUTPUT_BITRATE_KBPS },
      });

      // With `outputAudioFormat` set, `result.audio` is the encoded
      // MP3 bytes (Uint8Array), not a RawAudio object.
      const audio = Buffer.from(result.audio as Uint8Array);

      // Duration comes from the synthesis timeline: the last entry's
      // `endTime` (seconds) marks speech end, excluding the trailing
      // end-pause silence echogarden pads the file with. Speech end is
      // the duration convention across providers here — edge-tts uses
      // subtitle metadata, ElevenLabs character alignment — and it is
      // what step timing consumes as screen time.
      let durationMs = 0;
      const timeline = result.timeline;
      if (Array.isArray(timeline) && timeline.length > 0) {
        const endTime: number = timeline[timeline.length - 1].endTime ?? 0;
        durationMs = Math.ceil(endTime * 1000);
      }

      if (durationMs === 0 && audio.length > 0) {
        durationMs = Math.ceil((audio.length * 8) / OUTPUT_BITRATE_KBPS);
      }

      return { audio, durationMs };
    },
  };
}
