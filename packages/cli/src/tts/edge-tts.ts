import type { TtsProvider, TtsOptions, TtsResult } from "./types.js";

const DEFAULT_VOICE = "en-US-AndrewMultilingualNeural";

/**
 * Edge TTS outputs mono MP3 at 48 kbps. Used as a fallback when
 * subtitle metadata is unavailable for precise duration.
 */
const EDGE_TTS_BITRATE_KBPS = 48;

/**
 * Checks whether the `edge-tts-universal` package is available at runtime.
 * Returns `true` if it can be imported, `false` otherwise.
 */
export async function isEdgeTtsAvailable(): Promise<boolean> {
  try {
    await import("edge-tts-universal");
    return true;
  } catch {
    return false;
  }
}

/**
 * TTS provider backed by Microsoft Edge TTS via `edge-tts-universal`.
 * Free, requires no API keys, but needs network access.
 *
 * `edge-tts-universal` is an **optional peer dependency** (AGPL-3.0 licensed).
 * Users must install it explicitly: `pnpm add edge-tts-universal`.
 *
 * Duration is extracted from word-boundary subtitle metadata returned by
 * the service. Falls back to a bitrate-based estimate when metadata is
 * unavailable — same approach proven in Stigmer's narration pipeline.
 */
export function createEdgeTtsProvider(): TtsProvider {
  return {
    name: "edge-tts",

    async synthesize(text: string, options: TtsOptions): Promise<TtsResult> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let EdgeTTS: any;
      try {
        const mod = await import("edge-tts-universal");
        EdgeTTS = mod.EdgeTTS;
      } catch {
        throw new Error(
          "edge-tts-universal is not installed. Install it with:\n\n" +
            "  pnpm add edge-tts-universal\n\n" +
            "Or use a different TTS provider: --tts echogarden, --tts openai",
        );
      }

      const voice = options.voice ?? DEFAULT_VOICE;
      const tts = new EdgeTTS(text, voice);
      const result = await tts.synthesize();

      const audioBuffer = Buffer.from(await result.audio.arrayBuffer());

      let durationMs = 0;
      if (result.subtitle.length > 0) {
        const last = result.subtitle[result.subtitle.length - 1];
        // offset and duration are in 100-nanosecond units
        durationMs = Math.ceil((last.offset + last.duration) / 10_000);
      }

      if (durationMs === 0 && audioBuffer.length > 0) {
        durationMs = Math.ceil((audioBuffer.length * 8) / EDGE_TTS_BITRATE_KBPS);
      }

      return { audio: audioBuffer, durationMs };
    },
  };
}
