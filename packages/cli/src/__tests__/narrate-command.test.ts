import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { TtsProvider } from "../tts/types.js";

vi.mock("../util/load-ts.js", () => ({
  loadStepsFromTs: vi.fn(),
}));

vi.mock("../util/discover-scenarios.js", () => ({
  discoverScenarios: vi.fn(),
}));

vi.mock("../tts/resolve-provider.js", () => ({
  resolveProvider: vi.fn(),
}));

import { loadStepsFromTs } from "../util/load-ts.js";
import { discoverScenarios } from "../util/discover-scenarios.js";
import { resolveProvider } from "../tts/resolve-provider.js";

const mockLoadTs = vi.mocked(loadStepsFromTs);
const mockDiscover = vi.mocked(discoverScenarios);
const mockResolveProvider = vi.mocked(resolveProvider);

function createMockProvider(
  responses: Array<{ audio: Buffer; durationMs: number }>,
  fingerprint = "test-tts/default-config",
): TtsProvider {
  let callIndex = 0;
  return {
    name: "test-tts",
    fingerprint,
    synthesize: vi.fn(async () => {
      const response = responses[callIndex];
      if (!response) throw new Error("unexpected synthesize call");
      callIndex++;
      return response;
    }),
  };
}

describe("scenar narrate — runtime manifest format", () => {
  let stderrData: string;
  let originalExitCode: number | undefined;
  let tempDir: string;

  beforeEach(() => {
    stderrData = "";
    originalExitCode = process.exitCode;
    process.exitCode = undefined;
    tempDir = mkdtempSync(join(tmpdir(), "scenar-test-"));

    vi.spyOn(process.stderr, "write").mockImplementation((chunk: string | Uint8Array) => {
      stderrData += String(chunk);
      return true;
    });
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("generates manifest in @scenar/core format with caching", async () => {
    const scenariosDir = join(tempDir, "scenarios");
    mkdirSync(join(scenariosDir, "my-demo"), { recursive: true });
    writeFileSync(join(scenariosDir, "my-demo", "steps.ts"), "");

    mockDiscover.mockResolvedValue([
      { id: "my-demo", stepsPath: join(scenariosDir, "my-demo", "steps.ts") },
    ]);

    mockLoadTs.mockResolvedValue([
      { delayMs: 0, narration: "Welcome to the demo." },
      { delayMs: 1500 },
      { delayMs: 2000, narration: "That's it!" },
    ]);

    const provider = createMockProvider([
      { audio: Buffer.from("audio-0"), durationMs: 2340 },
      { audio: Buffer.from("audio-2"), durationMs: 1870 },
    ]);
    mockResolveProvider.mockResolvedValue(provider);

    const outDir = join(tempDir, "out");

    const { registerNarrateCommand } = await import("../commands/narrate.js");
    const { Command } = await import("commander");
    const program = new Command();
    registerNarrateCommand(program);

    await program.parseAsync([
      "node", "scenar", "narrate", scenariosDir,
      "--out", outDir, "--tts", "edge-tts", "--base-url", "/demos",
    ]);

    expect(existsSync(join(outDir, "my-demo", "step-0.mp3"))).toBe(true);
    expect(existsSync(join(outDir, "my-demo", "step-2.mp3"))).toBe(true);
    expect(existsSync(join(outDir, "my-demo", "step-1.mp3"))).toBe(false);

    const manifest = JSON.parse(readFileSync(join(outDir, "my-demo", "manifest.json"), "utf-8"));
    expect(manifest.steps).toHaveLength(3);
    expect(manifest.steps[0]).toEqual({ src: "/demos/my-demo/step-0.mp3", durationMs: 2340 });
    expect(manifest.steps[1]).toBeNull();
    expect(manifest.steps[2]).toEqual({ src: "/demos/my-demo/step-2.mp3", durationMs: 1870 });

    expect(manifest).not.toHaveProperty("generatedAt");
    expect(manifest).not.toHaveProperty("ttsProvider");

    const cache = JSON.parse(readFileSync(join(outDir, "my-demo", ".narration-cache.json"), "utf-8"));
    expect(cache.fingerprint).toBe("test-tts/default-config");
    expect(cache.steps).toHaveLength(3);
    expect(cache.steps[0]).toHaveProperty("hash");
    expect(cache.steps[0]).toHaveProperty("durationMs", 2340);
    expect(cache.steps[1]).toBeNull();

    expect(provider.synthesize).toHaveBeenCalledTimes(2);
  });

  it("uses cache on second run when narration text is unchanged", async () => {
    const scenariosDir = join(tempDir, "scenarios");
    mkdirSync(join(scenariosDir, "cached-demo"), { recursive: true });
    writeFileSync(join(scenariosDir, "cached-demo", "steps.ts"), "");

    mockDiscover.mockResolvedValue([
      { id: "cached-demo", stepsPath: join(scenariosDir, "cached-demo", "steps.ts") },
    ]);

    mockLoadTs.mockResolvedValue([
      { delayMs: 0, narration: "Hello world." },
      { delayMs: 1000 },
    ]);

    const provider1 = createMockProvider([
      { audio: Buffer.from("audio-hello"), durationMs: 1200 },
    ]);
    mockResolveProvider.mockResolvedValue(provider1);

    const outDir = join(tempDir, "out");

    const { registerNarrateCommand } = await import("../commands/narrate.js");
    const { Command } = await import("commander");

    const program1 = new Command();
    registerNarrateCommand(program1);
    await program1.parseAsync([
      "node", "scenar", "narrate", scenariosDir,
      "--out", outDir, "--tts", "edge-tts", "--base-url", "/demos",
    ]);

    expect(provider1.synthesize).toHaveBeenCalledTimes(1);

    const provider2 = createMockProvider([]);
    mockResolveProvider.mockResolvedValue(provider2);

    const program2 = new Command();
    registerNarrateCommand(program2);
    await program2.parseAsync([
      "node", "scenar", "narrate", scenariosDir,
      "--out", outDir, "--tts", "edge-tts", "--base-url", "/demos",
    ]);

    expect(provider2.synthesize).not.toHaveBeenCalled();
    expect(stderrData).toContain("cached");
  });

  it("regenerates on second run when the provider fingerprint changes", async () => {
    const scenariosDir = join(tempDir, "scenarios");
    mkdirSync(join(scenariosDir, "switch-demo"), { recursive: true });
    writeFileSync(join(scenariosDir, "switch-demo", "steps.ts"), "");

    mockDiscover.mockResolvedValue([
      { id: "switch-demo", stepsPath: join(scenariosDir, "switch-demo", "steps.ts") },
    ]);

    mockLoadTs.mockResolvedValue([
      { delayMs: 0, narration: "Hello world." },
    ]);

    const outDir = join(tempDir, "out");

    const { registerNarrateCommand } = await import("../commands/narrate.js");
    const { Command } = await import("commander");

    const openaiLike = createMockProvider(
      [{ audio: Buffer.from("openai-audio"), durationMs: 1200 }],
      "openai/tts-1/alloy",
    );
    mockResolveProvider.mockResolvedValue(openaiLike);

    const program1 = new Command();
    registerNarrateCommand(program1);
    await program1.parseAsync([
      "node", "scenar", "narrate", scenariosDir, "--out", outDir,
    ]);

    expect(openaiLike.synthesize).toHaveBeenCalledTimes(1);

    // Same text, same voice — but a different provider configuration.
    // The old audio must NOT be served as a cache hit.
    const elevenlabsLike = createMockProvider(
      [{ audio: Buffer.from("elevenlabs-audio"), durationMs: 1350 }],
      "elevenlabs/eleven_multilingual_v2/21m00Tcm4TlvDq8ikWAM",
    );
    mockResolveProvider.mockResolvedValue(elevenlabsLike);

    const program2 = new Command();
    registerNarrateCommand(program2);
    await program2.parseAsync([
      "node", "scenar", "narrate", scenariosDir, "--out", outDir,
    ]);

    expect(elevenlabsLike.synthesize).toHaveBeenCalledTimes(1);

    const manifest = JSON.parse(
      readFileSync(join(outDir, "switch-demo", "manifest.json"), "utf-8"),
    );
    expect(manifest.steps[0].durationMs).toBe(1350);

    const cache = JSON.parse(
      readFileSync(join(outDir, "switch-demo", ".narration-cache.json"), "utf-8"),
    );
    expect(cache.fingerprint).toBe("elevenlabs/eleven_multilingual_v2/21m00Tcm4TlvDq8ikWAM");
  });

  it("warns when no scenarios have narration", async () => {
    const scenariosDir = join(tempDir, "scenarios");
    mkdirSync(join(scenariosDir, "empty-demo"), { recursive: true });
    writeFileSync(join(scenariosDir, "empty-demo", "steps.ts"), "");

    mockDiscover.mockResolvedValue([
      { id: "empty-demo", stepsPath: join(scenariosDir, "empty-demo", "steps.ts") },
    ]);

    mockLoadTs.mockResolvedValue([
      { delayMs: 0 },
      { delayMs: 1000 },
    ]);

    const provider = createMockProvider([]);
    mockResolveProvider.mockResolvedValue(provider);

    const { registerNarrateCommand } = await import("../commands/narrate.js");
    const { Command } = await import("commander");
    const program = new Command();
    registerNarrateCommand(program);

    await program.parseAsync([
      "node", "scenar", "narrate", scenariosDir,
      "--out", join(tempDir, "out"), "--tts", "edge-tts",
    ]);

    expect(stderrData).toContain("no narration");
    expect(provider.synthesize).not.toHaveBeenCalled();
  });

  it("warns when no scenario directories found", async () => {
    const emptyDir = join(tempDir, "empty");
    mkdirSync(emptyDir, { recursive: true });

    mockDiscover.mockResolvedValue([]);

    const provider = createMockProvider([]);
    mockResolveProvider.mockResolvedValue(provider);

    const { registerNarrateCommand } = await import("../commands/narrate.js");
    const { Command } = await import("commander");
    const program = new Command();
    registerNarrateCommand(program);

    await program.parseAsync([
      "node", "scenar", "narrate", emptyDir,
      "--out", join(tempDir, "out"), "--tts", "edge-tts",
    ]);

    expect(stderrData).toContain("No scenario directories");
  });
});
