import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("edge-tts-universal", () => {
  const mockSynthesize = vi.fn();
  const MockEdgeTTS = vi.fn().mockImplementation(() => ({
    synthesize: mockSynthesize,
  }));
  return { EdgeTTS: MockEdgeTTS, __mockSynthesize: mockSynthesize };
});

import { EdgeTTS } from "edge-tts-universal";

// Access the inner mock so tests can configure per-call responses.
const MockEdgeTTS = vi.mocked(EdgeTTS);
const mockSynthesize = (
  await import("edge-tts-universal") as { __mockSynthesize: ReturnType<typeof vi.fn> }
).__mockSynthesize;

import { createEdgeTtsProvider } from "../tts/edge-tts.js";

describe("Edge TTS provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("synthesizes with correct voice and text", async () => {
    const fakeAudio = new Blob([new Uint8Array([0xff, 0xfb, 0x90])]);
    mockSynthesize.mockResolvedValue({
      audio: fakeAudio,
      subtitle: [{ offset: 0, duration: 25_000_000 }],
    });

    const provider = createEdgeTtsProvider();
    const result = await provider.synthesize("Hello world", { voice: "en-US-JennyNeural" });

    expect(MockEdgeTTS).toHaveBeenCalledWith("Hello world", "en-US-JennyNeural");
    expect(result.audio).toBeInstanceOf(Buffer);
    expect(result.durationMs).toBe(2500);
  });

  it("uses default voice when none provided", async () => {
    const fakeAudio = new Blob([new Uint8Array(100)]);
    mockSynthesize.mockResolvedValue({
      audio: fakeAudio,
      subtitle: [{ offset: 0, duration: 10_000_000 }],
    });

    const provider = createEdgeTtsProvider();
    await provider.synthesize("Test", {});

    expect(MockEdgeTTS).toHaveBeenCalledWith("Test", "en-US-AndrewMultilingualNeural");
  });

  it("computes duration from the last subtitle entry", async () => {
    const fakeAudio = new Blob([new Uint8Array(500)]);
    mockSynthesize.mockResolvedValue({
      audio: fakeAudio,
      subtitle: [
        { offset: 0, duration: 5_000_000 },
        { offset: 5_000_000, duration: 8_000_000 },
        { offset: 13_000_000, duration: 7_000_000 },
      ],
    });

    const provider = createEdgeTtsProvider();
    const result = await provider.synthesize("Multi-word sentence", {});

    // Last entry: offset 13_000_000 + duration 7_000_000 = 20_000_000 hundred-nanoseconds = 2000ms
    expect(result.durationMs).toBe(2000);
  });

  it("falls back to bitrate estimate when subtitle is empty", async () => {
    const audioBytes = new Uint8Array(6000);
    const fakeAudio = new Blob([audioBytes]);
    mockSynthesize.mockResolvedValue({
      audio: fakeAudio,
      subtitle: [],
    });

    const provider = createEdgeTtsProvider();
    const result = await provider.synthesize("No subtitles", {});

    // 6000 bytes * 8 bits / 48 kbps = 1000ms
    expect(result.durationMs).toBe(1000);
  });
});
