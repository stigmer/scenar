import type { TtsProvider, TtsOptions, TtsResult } from "./types.js";

const OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech";
const DEFAULT_MODEL = "tts-1";
const DEFAULT_VOICE = "alloy";

/**
 * TTS provider backed by OpenAI's text-to-speech API.
 * Requires the `OPENAI_API_KEY` environment variable.
 */
export function createOpenAIProvider(): TtsProvider {
  return {
    name: "openai",

    async synthesize(text: string, options: TtsOptions): Promise<TtsResult> {
      const apiKey = process.env["OPENAI_API_KEY"];
      if (!apiKey) {
        throw new Error(
          "OPENAI_API_KEY environment variable is not set.\n\n" +
          "Set it before running narrate:\n" +
          "  export OPENAI_API_KEY=sk-...\n\n" +
          "Or use a different TTS provider: --tts echogarden",
        );
      }

      const voice = options.voice ?? DEFAULT_VOICE;

      const response = await fetch(OPENAI_TTS_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          input: text,
          voice,
          response_format: "mp3",
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `OpenAI TTS API error (${response.status}): ${body}`,
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const audio = Buffer.from(arrayBuffer);

      const durationMs = estimateMp3DurationMs(audio);

      return { audio, durationMs };
    },
  };
}

/**
 * Rough MP3 duration estimate from file size and assumed bitrate.
 * OpenAI tts-1 defaults to ~64 kbps MP3 output. This is a fallback
 * when precise duration parsing isn't available.
 */
function estimateMp3DurationMs(mp3: Buffer): number {
  const ASSUMED_BITRATE_KBPS = 64;
  const bytes = mp3.byteLength;
  return Math.round((bytes * 8) / ASSUMED_BITRATE_KBPS);
}
