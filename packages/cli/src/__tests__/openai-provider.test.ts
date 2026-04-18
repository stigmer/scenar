import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createOpenAIProvider } from "../tts/openai.js";

describe("OpenAI TTS provider", () => {
  const originalEnv = process.env["OPENAI_API_KEY"];

  beforeEach(() => {
    delete process.env["OPENAI_API_KEY"];
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env["OPENAI_API_KEY"] = originalEnv;
    } else {
      delete process.env["OPENAI_API_KEY"];
    }
    vi.restoreAllMocks();
  });

  it("throws when OPENAI_API_KEY is not set", async () => {
    const provider = createOpenAIProvider();
    await expect(provider.synthesize("hello", {})).rejects.toThrow(/OPENAI_API_KEY/);
  });

  it("calls the OpenAI API with correct parameters", async () => {
    process.env["OPENAI_API_KEY"] = "sk-test-key";

    const fakeAudio = new ArrayBuffer(1000);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(fakeAudio),
    });
    vi.stubGlobal("fetch", mockFetch);

    const provider = createOpenAIProvider();
    const result = await provider.synthesize("hello world", { voice: "nova" });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://api.openai.com/v1/audio/speech");

    const body = JSON.parse(init.body as string);
    expect(body.input).toBe("hello world");
    expect(body.voice).toBe("nova");
    expect(body.response_format).toBe("mp3");

    expect(result.audio).toBeInstanceOf(Buffer);
    expect(result.durationMs).toBeGreaterThan(0);
  });

  it("throws on non-OK response", async () => {
    process.env["OPENAI_API_KEY"] = "sk-test-key";

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    }));

    const provider = createOpenAIProvider();
    await expect(provider.synthesize("hello", {})).rejects.toThrow(/401/);
  });
});
