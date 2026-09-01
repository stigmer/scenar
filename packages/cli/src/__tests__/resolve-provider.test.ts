import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../tts/echogarden.js", () => ({
  isEchogardenAvailable: vi.fn(),
  createEchogardenProvider: vi.fn(() => ({
    name: "echogarden",
    fingerprint: "echogarden/vits/mp3-64",
    synthesize: vi.fn(),
  })),
}));

vi.mock("../tts/edge-tts.js", () => ({
  isEdgeTtsAvailable: vi.fn(),
  createEdgeTtsProvider: vi.fn(() => ({
    name: "edge-tts",
    fingerprint: "edge-tts/voice",
    synthesize: vi.fn(),
  })),
}));

vi.mock("../tts/openai.js", () => ({
  createOpenAIProvider: vi.fn(() => ({
    name: "openai",
    fingerprint: "openai/tts-1/alloy",
    synthesize: vi.fn(),
  })),
}));

vi.mock("../tts/elevenlabs.js", () => ({
  createElevenLabsProvider: vi.fn(() => ({
    name: "elevenlabs",
    fingerprint: "elevenlabs/model/voice",
    synthesize: vi.fn(),
  })),
}));

import { resolveProvider } from "../tts/resolve-provider.js";
import { isEchogardenAvailable } from "../tts/echogarden.js";
import { isEdgeTtsAvailable } from "../tts/edge-tts.js";

const mockEchogardenAvailable = vi.mocked(isEchogardenAvailable);
const mockEdgeTtsAvailable = vi.mocked(isEdgeTtsAvailable);

describe("resolveProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns OpenAI provider when requested", async () => {
    const provider = await resolveProvider("openai");
    expect(provider.name).toBe("openai");
  });

  it("returns ElevenLabs provider when requested", async () => {
    const provider = await resolveProvider("elevenlabs");
    expect(provider.name).toBe("elevenlabs");
  });

  it("returns Echogarden provider when installed", async () => {
    mockEchogardenAvailable.mockResolvedValue(true);
    const provider = await resolveProvider("echogarden");
    expect(provider.name).toBe("echogarden");
  });

  it("throws when Echogarden is not installed", async () => {
    mockEchogardenAvailable.mockResolvedValue(false);
    await expect(resolveProvider("echogarden")).rejects.toThrow(/not installed/);
  });

  it("returns Edge TTS provider when installed", async () => {
    mockEdgeTtsAvailable.mockResolvedValue(true);
    const provider = await resolveProvider("edge-tts");
    expect(provider.name).toBe("edge-tts");
  });

  it("throws when edge-tts-universal is not installed", async () => {
    mockEdgeTtsAvailable.mockResolvedValue(false);
    await expect(resolveProvider("edge-tts")).rejects.toThrow(/not installed/);
  });

  it("throws on unknown provider name", async () => {
    await expect(resolveProvider("whisper")).rejects.toThrow(/Unknown TTS provider/);
  });

  it("lists elevenlabs among supported providers in the unknown-provider error", async () => {
    await expect(resolveProvider("whisper")).rejects.toThrow(/elevenlabs/);
  });
});
