import { describe, it, expect, vi } from "vitest";
import { join, basename } from "node:path";
import { loadBundle } from "../util/load-bundle.js";
import * as loadTs from "../util/load-ts.js";
import * as fs from "node:fs/promises";

vi.mock("../util/load-ts.js");
vi.mock("node:fs/promises");

describe("loadBundle", () => {
  const mockSteps = [
    { delayMs: 0, narration: "Step one narration" },
    { delayMs: 2000, narration: "Step two narration" },
    { delayMs: 1500 },
  ];

  const mockManifest = {
    steps: [
      { src: "/audio/step-0.mp3", durationMs: 3000 },
      { src: "/audio/step-1.mp3", durationMs: 2500 },
      null,
    ],
  };

  it("loads steps and narration manifest from a directory", async () => {
    vi.mocked(loadTs.loadStepsFromTs).mockResolvedValue(mockSteps);
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockManifest) as never);

    const bundle = await loadBundle("/fake/scenarios/quickstart-tour");

    expect(bundle.id).toBe("quickstart-tour");
    expect(bundle.steps).toHaveLength(3);
    expect(bundle.steps[0]!.delayMs).toBe(0);
    expect(bundle.narrationManifest).toBeDefined();
    expect(bundle.narrationManifest!.steps).toHaveLength(3);
    expect(bundle.narrationManifest!.steps[2]).toBeNull();
  });

  it("uses the directory basename as the bundle id", async () => {
    vi.mocked(loadTs.loadStepsFromTs).mockResolvedValue(mockSteps);
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockManifest) as never);

    const bundle = await loadBundle("/some/path/my-demo");
    expect(bundle.id).toBe("my-demo");
  });

  it("returns undefined manifest when no manifest.json exists", async () => {
    vi.mocked(loadTs.loadStepsFromTs).mockResolvedValue(mockSteps);
    vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));

    const bundle = await loadBundle("/fake/scenarios/no-audio-demo");
    expect(bundle.narrationManifest).toBeUndefined();
  });
});
