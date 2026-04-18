import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../tts/echogarden.js", () => ({
  isEchogardenAvailable: vi.fn(),
  createEchogardenProvider: vi.fn(() => ({ name: "echogarden", synthesize: vi.fn() })),
}));

vi.mock("../tts/edge-tts.js", () => ({
  isEdgeTtsAvailable: vi.fn(),
  createEdgeTtsProvider: vi.fn(() => ({ name: "edge-tts", synthesize: vi.fn() })),
}));

vi.mock("../tts/openai.js", () => ({
  createOpenAIProvider: vi.fn(() => ({ name: "openai", synthesize: vi.fn() })),
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
});
