import type { TtsProvider, TtsOptions, TtsResult } from "./types.js";

const ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const DEFAULT_MODEL = "eleven_multilingual_v2";

/** Rachel — an ElevenLabs stock voice available to every account. */
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

/**
 * Requested output format: MP3, 44.1 kHz, 128 kbps. Available on the
 * ElevenLabs free tier (192 kbps requires Creator+). The bitrate doubles
 * as the fallback duration estimate when alignment data is unavailable.
 */
const OUTPUT_FORMAT = "mp3_44100_128";
const OUTPUT_BITRATE_KBPS = 128;

/**
 * Response shape of the `with-timestamps` endpoint variant: audio arrives
 * base64-encoded alongside character-level timing alignment.
 */
interface TimestampsResponse {
  audio_base64: string;
  alignment: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  } | null;
}

/**
 * TTS provider backed by ElevenLabs' text-to-speech API.
 * Requires the `ELEVENLABS_API_KEY` environment variable.
 *
 * Uses the `with-timestamps` endpoint variant so the audio duration comes
 * from the API's character alignment data (exact) rather than a bitrate
 * estimate. Duration drives step timing — `atPercent` interactions are
 * measured against it — so precision here keeps narration and motion in sync.
 *
 * Model defaults to Multilingual v2 (~$0.10 per finished minute) and can be
 * overridden with the `ELEVENLABS_MODEL_ID` environment variable.
 */
export function createElevenLabsProvider(): TtsProvider {
  const model = process.env["ELEVENLABS_MODEL_ID"] ?? DEFAULT_MODEL;

  return {
    name: "elevenlabs",
    fingerprint: `elevenlabs/${model}/${DEFAULT_VOICE_ID}`,

    async synthesize(text: string, options: TtsOptions): Promise<TtsResult> {
      const apiKey = process.env["ELEVENLABS_API_KEY"];
      if (!apiKey) {
        throw new Error(
          "ELEVENLABS_API_KEY environment variable is not set.\n\n" +
          "Set it before running narrate:\n" +
          "  export ELEVENLABS_API_KEY=...\n\n" +
          "Or use a different TTS provider: --tts openai",
        );
      }

      const voiceId = options.voice ?? DEFAULT_VOICE_ID;
      const url =
        `${ELEVENLABS_TTS_URL}/${voiceId}/with-timestamps` +
        `?output_format=${OUTPUT_FORMAT}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: model,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `ElevenLabs TTS API error (${response.status}): ${body}`,
        );
      }

      const payload = (await response.json()) as TimestampsResponse;
      const audio = Buffer.from(payload.audio_base64, "base64");

      const endTimes = payload.alignment?.character_end_times_seconds;
      const durationMs =
        endTimes && endTimes.length > 0
          ? Math.ceil(endTimes[endTimes.length - 1]! * 1000)
          : estimateMp3DurationMs(audio);

      return { audio, durationMs };
    },
  };
}

/**
 * Rough MP3 duration estimate from file size and the requested bitrate.
 * Only used as a fallback when the API returns no alignment data.
 */
function estimateMp3DurationMs(mp3: Buffer): number {
  const bytes = mp3.byteLength;
  return Math.round((bytes * 8) / OUTPUT_BITRATE_KBPS);
}
