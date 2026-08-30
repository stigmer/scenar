import type { TtsProvider, TtsOptions, TtsResult } from "./types.js";

const ENGINE = "vits";

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
 */
export function createEchogardenProvider(): TtsProvider {
  return {
    name: "echogarden",
    fingerprint: `echogarden/${ENGINE}`,

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
      });

      const rawAudio = result.audio;
      const sampleRate: number = rawAudio.sampleRate ?? 22050;
      const samples: number = rawAudio.audioChannels?.[0]?.length ?? 0;
      const durationMs = Math.round((samples / sampleRate) * 1000);

      const mp3Bytes: Uint8Array = await echogarden.encodeRawAudioToMp3(rawAudio);

      return {
        audio: Buffer.from(mp3Bytes),
        durationMs,
      };
    },
  };
}
