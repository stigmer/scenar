import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runNarrate } from "../commands/narrate.js";
import type { NarrationManifest, TtsProvider } from "../tts/types.js";

vi.mock("../util/load-yaml.js", () => ({
  loadScenarioYaml: vi.fn(),
}));

import { loadScenarioYaml } from "../util/load-yaml.js";

const mockLoad = vi.mocked(loadScenarioYaml);

function createMockProvider(responses: Array<{ audio: Buffer; durationMs: number }>): TtsProvider {
  let callIndex = 0;
  return {
    name: "test-tts",
    synthesize: vi.fn(async () => {
      const response = responses[callIndex];
      if (!response) throw new Error("unexpected synthesize call");
      callIndex++;
      return response;
    }),
  };
}

describe("scenar narrate", () => {
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

  it("generates audio files and manifest for narrated steps", async () => {
    mockLoad.mockResolvedValue({
      steps: [
        { view: "intro", delayMs: 0, narrationText: "Welcome to the demo." },
        { view: "settings", delayMs: 1500, narrationText: "" },
        { view: "finish", delayMs: 2000, narrationText: "That's it!" },
      ],
    });

    const provider = createMockProvider([
      { audio: Buffer.from("audio-data-0"), durationMs: 2340 },
      { audio: Buffer.from("audio-data-2"), durationMs: 1870 },
    ]);

    const outDir = join(tempDir, "narration");
    await runNarrate("demo.yaml", { tts: "echogarden", out: outDir }, provider);

    expect(provider.synthesize).toHaveBeenCalledTimes(2);

    expect(existsSync(join(outDir, "step-0.mp3"))).toBe(true);
    expect(existsSync(join(outDir, "step-2.mp3"))).toBe(true);
    expect(existsSync(join(outDir, "step-1.mp3"))).toBe(false);

    const rawAudio = readFileSync(join(outDir, "step-0.mp3"), "utf-8");
    expect(rawAudio).toBe("audio-data-0");

    const manifestRaw = readFileSync(join(outDir, "manifest.json"), "utf-8");
    const manifest: NarrationManifest = JSON.parse(manifestRaw);

    expect(manifest.ttsProvider).toBe("test-tts");
    expect(manifest.steps).toHaveLength(2);
    expect(manifest.steps[0]!.index).toBe(0);
    expect(manifest.steps[0]!.file).toBe("step-0.mp3");
    expect(manifest.steps[0]!.durationMs).toBe(2340);
    expect(manifest.steps[0]!.text).toBe("Welcome to the demo.");
    expect(manifest.steps[1]!.index).toBe(2);
    expect(manifest.steps[1]!.durationMs).toBe(1870);

    expect(stderrData).toContain("Generated 2 audio file(s)");
  });

  it("warns when no steps have narration text", async () => {
    mockLoad.mockResolvedValue({
      steps: [
        { view: "intro", delayMs: 0 },
        { view: "finish", delayMs: 1000 },
      ],
    });

    const provider = createMockProvider([]);
    await runNarrate("demo.yaml", { tts: "echogarden", out: tempDir }, provider);

    expect(stderrData).toContain("No steps contain narration text");
    expect(process.exitCode).toBeUndefined();
    expect(provider.synthesize).not.toHaveBeenCalled();
  });

  it("exits with error if scenario is invalid", async () => {
    mockLoad.mockResolvedValue({ steps: [] });

    const provider = createMockProvider([]);
    await runNarrate("bad.yaml", { tts: "echogarden", out: tempDir }, provider);

    expect(stderrData).toContain("error");
    expect(process.exitCode).toBe(1);
    expect(provider.synthesize).not.toHaveBeenCalled();
  });
});
