import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElevenLabsProvider } from "../tts/elevenlabs.js";

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

/** Build a successful with-timestamps API payload around the given audio bytes. */
function timestampsPayload(
  audio: Buffer,
  endTimesSeconds: number[] | null,
): Record<string, unknown> {
  return {
    audio_base64: audio.toString("base64"),
    alignment:
      endTimesSeconds === null
        ? null
        : {
            characters: endTimesSeconds.map(() => "x"),
            character_start_times_seconds: endTimesSeconds.map((t) => t - 0.1),
            character_end_times_seconds: endTimesSeconds,
          },
  };
}

function mockFetchOk(payload: Record<string, unknown>) {
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(payload),
  });
  vi.stubGlobal("fetch", mockFetch);
  return mockFetch;
}

describe("ElevenLabs TTS provider", () => {
  const originalApiKey = process.env["ELEVENLABS_API_KEY"];
  const originalModelId = process.env["ELEVENLABS_MODEL_ID"];

  beforeEach(() => {
    delete process.env["ELEVENLABS_API_KEY"];
    delete process.env["ELEVENLABS_MODEL_ID"];
  });

  afterEach(() => {
    if (originalApiKey !== undefined) {
      process.env["ELEVENLABS_API_KEY"] = originalApiKey;
    } else {
      delete process.env["ELEVENLABS_API_KEY"];
    }
    if (originalModelId !== undefined) {
      process.env["ELEVENLABS_MODEL_ID"] = originalModelId;
    } else {
      delete process.env["ELEVENLABS_MODEL_ID"];
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("throws when ELEVENLABS_API_KEY is not set", async () => {
    const provider = createElevenLabsProvider();
    await expect(provider.synthesize("hello", {})).rejects.toThrow(/ELEVENLABS_API_KEY/);
  });

  it("calls the with-timestamps endpoint with correct parameters", async () => {
    process.env["ELEVENLABS_API_KEY"] = "el-test-key";

    const audio = Buffer.from("fake-mp3-bytes");
    const mockFetch = mockFetchOk(timestampsPayload(audio, [0.5, 1.2, 2.345]));

    const provider = createElevenLabsProvider();
    const result = await provider.synthesize("hello world", { voice: "custom-voice-id" });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe(
      "https://api.elevenlabs.io/v1/text-to-speech/custom-voice-id/with-timestamps" +
        "?output_format=mp3_44100_128",
    );
    expect(init.headers["xi-api-key"]).toBe("el-test-key");

    const body = JSON.parse(init.body as string);
    expect(body.text).toBe("hello world");
    expect(body.model_id).toBe("eleven_multilingual_v2");

    expect(result.audio).toBeInstanceOf(Buffer);
    expect(result.audio.equals(audio)).toBe(true);
  });

  it("uses the default stock voice when no voice is given", async () => {
    process.env["ELEVENLABS_API_KEY"] = "el-test-key";

    const mockFetch = mockFetchOk(timestampsPayload(Buffer.from("audio"), [1.0]));

    const provider = createElevenLabsProvider();
    await provider.synthesize("hello", {});

    const [url] = mockFetch.mock.calls[0]!;
    expect(url).toContain(`/text-to-speech/${DEFAULT_VOICE_ID}/`);
  });

  it("derives exact duration from the last alignment end time", async () => {
    process.env["ELEVENLABS_API_KEY"] = "el-test-key";

    mockFetchOk(timestampsPayload(Buffer.from("audio"), [0.5, 1.2, 2.3456]));

    const provider = createElevenLabsProvider();
    const result = await provider.synthesize("hello", {});

    // ceil(2.3456s * 1000) — never truncate narration shorter than it is.
    expect(result.durationMs).toBe(2346);
  });

  it("falls back to a bitrate estimate when alignment is null", async () => {
    process.env["ELEVENLABS_API_KEY"] = "el-test-key";

    // 16000 bytes at 128 kbps: (16000 * 8) / 128 = 1000ms.
    const audio = Buffer.alloc(16000);
    mockFetchOk(timestampsPayload(audio, null));

    const provider = createElevenLabsProvider();
    const result = await provider.synthesize("hello", {});

    expect(result.durationMs).toBe(1000);
  });

  it("falls back to a bitrate estimate when alignment arrays are empty", async () => {
    process.env["ELEVENLABS_API_KEY"] = "el-test-key";

    const audio = Buffer.alloc(3200);
    mockFetchOk(timestampsPayload(audio, []));

    const provider = createElevenLabsProvider();
    const result = await provider.synthesize("hello", {});

    expect(result.durationMs).toBe(200);
  });

  it("honors the ELEVENLABS_MODEL_ID override in request and fingerprint", async () => {
    process.env["ELEVENLABS_API_KEY"] = "el-test-key";
    process.env["ELEVENLABS_MODEL_ID"] = "eleven_v3";

    const mockFetch = mockFetchOk(timestampsPayload(Buffer.from("audio"), [1.0]));

    const provider = createElevenLabsProvider();
    expect(provider.fingerprint).toBe(`elevenlabs/eleven_v3/${DEFAULT_VOICE_ID}`);

    await provider.synthesize("hello", {});
    const [, init] = mockFetch.mock.calls[0]!;
    expect(JSON.parse(init.body as string).model_id).toBe("eleven_v3");
  });

  it("passes unicode narration text through unchanged", async () => {
    process.env["ELEVENLABS_API_KEY"] = "el-test-key";

    const mockFetch = mockFetchOk(timestampsPayload(Buffer.from("audio"), [1.0]));

    const provider = createElevenLabsProvider();
    const text = "Grüße — 你好, नमस्ते! 🚀";
    await provider.synthesize(text, {});

    const [, init] = mockFetch.mock.calls[0]!;
    expect(JSON.parse(init.body as string).text).toBe(text);
  });

  it("throws on non-OK response with status and body", async () => {
    process.env["ELEVENLABS_API_KEY"] = "el-test-key";

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("invalid api key"),
    }));

    const provider = createElevenLabsProvider();
    await expect(provider.synthesize("hello", {})).rejects.toThrow(/401.*invalid api key/);
  });

  it("returns an empty buffer without crashing when the API returns empty audio", async () => {
    process.env["ELEVENLABS_API_KEY"] = "el-test-key";

    mockFetchOk(timestampsPayload(Buffer.alloc(0), [1.5]));

    const provider = createElevenLabsProvider();
    const result = await provider.synthesize("hello", {});

    expect(result.audio.length).toBe(0);
    expect(result.durationMs).toBe(1500);
  });
});
