// @vitest-environment node
//
// Node environment (not the workspace-default jsdom): the drift guard
// below imports the real echogarden, a Node library that must not see
// browser globals.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("echogarden", () => {
  const mockSynthesize = vi.fn();
  return { synthesize: mockSynthesize, __mockSynthesize: mockSynthesize };
});

// Access the inner mock so tests can configure per-call responses.
const mockSynthesize = (
  await import("echogarden") as unknown as { __mockSynthesize: ReturnType<typeof vi.fn> }
).__mockSynthesize;

import { createEchogardenProvider } from "../tts/echogarden.js";

/** A minimal synthesis result: encoded MP3 bytes plus a timeline. */
function synthesisResult(
  audio: Uint8Array,
  timeline: Array<{ startTime: number; endTime: number }>,
) {
  return {
    audio,
    timeline: timeline.map((entry, i) => ({
      type: "segment",
      text: `segment ${i}`,
      ...entry,
    })),
  };
}

describe("Echogarden provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests MP3-encoded output from synthesize", async () => {
    mockSynthesize.mockResolvedValue(
      synthesisResult(new Uint8Array([0xff, 0xfb, 0x90]), [{ startTime: 0, endTime: 1.2 }]),
    );

    const provider = createEchogardenProvider();
    await provider.synthesize("Hello world", { voice: "en_US-libritts-high" });

    expect(mockSynthesize).toHaveBeenCalledWith("Hello world", {
      engine: "vits",
      voice: "en_US-libritts-high",
      outputAudioFormat: { codec: "mp3", bitrate: 64 },
    });
  });

  it("returns the encoded bytes as a Buffer", async () => {
    const mp3Bytes = new Uint8Array([0xff, 0xfb, 0x90, 0x01, 0x02]);
    mockSynthesize.mockResolvedValue(
      synthesisResult(mp3Bytes, [{ startTime: 0, endTime: 0.5 }]),
    );

    const provider = createEchogardenProvider();
    const result = await provider.synthesize("Hi", {});

    expect(result.audio).toBeInstanceOf(Buffer);
    expect([...result.audio]).toEqual([...mp3Bytes]);
  });

  it("derives duration from the last timeline entry's endTime", async () => {
    mockSynthesize.mockResolvedValue(
      synthesisResult(new Uint8Array(100), [
        { startTime: 0, endTime: 1.0 },
        { startTime: 1.0, endTime: 2.5 },
      ]),
    );

    const provider = createEchogardenProvider();
    const result = await provider.synthesize("Two segments", {});

    expect(result.durationMs).toBe(2500);
  });

  it("falls back to a bitrate estimate when the timeline is empty", async () => {
    // 6000 bytes * 8 bits / 64 kbps = 750ms
    mockSynthesize.mockResolvedValue(synthesisResult(new Uint8Array(6000), []));

    const provider = createEchogardenProvider();
    const result = await provider.synthesize("No timeline", {});

    expect(result.durationMs).toBe(750);
  });

  it("carries the output format in the cache fingerprint", () => {
    const provider = createEchogardenProvider();

    expect(provider.name).toBe("echogarden");
    // Codec/bitrate changes alter the audio bytes, so they are part of
    // the cache identity (see TtsProvider.fingerprint).
    expect(provider.fingerprint).toBe("echogarden/vits/mp3-64");
  });
});

describe("echogarden export surface (drift guard for #19)", () => {
  // The provider once crashed in users' narrate runs because an
  // echogarden update removed `encodeRawAudioToMp3` (issue #19). This
  // pins the real package's exports the provider now relies on, so the
  // next export-surface drift fails here instead. Export pinning only —
  // a live synthesis would pull voice-model downloads into CI.
  it("pins the exports the provider relies on", { timeout: 30_000 }, async (ctx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let echogarden: any;
    try {
      echogarden = await vi.importActual("echogarden");
    } catch {
      ctx.skip(); // optional dependency not installed in this environment
      return;
    }

    expect(typeof echogarden.synthesize).toBe("function");
    expect(echogarden.defaultSynthesisOptions).toBeTypeOf("object");
    expect("outputAudioFormat" in echogarden.defaultSynthesisOptions).toBe(true);
  });
});

describe("Echogarden provider when the package is missing", () => {
  it("throws install guidance", async () => {
    // Re-register the module as unloadable, then re-import the provider
    // so its dynamic import hits the failing registration.
    vi.resetModules();
    vi.doMock("echogarden", () => {
      throw new Error("Cannot find module 'echogarden'");
    });

    const { createEchogardenProvider: createProvider } =
      await import("../tts/echogarden.js");

    await expect(createProvider().synthesize("Hi", {})).rejects.toThrow(
      /pnpm add echogarden/,
    );

    vi.doUnmock("echogarden");
  });
});
