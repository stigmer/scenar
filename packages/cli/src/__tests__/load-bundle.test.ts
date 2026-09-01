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

  it("loads the presenter manifest when one exists", async () => {
    const presenterManifest = {
      steps: [{ src: "./step-0.mp4", durationMs: 3000 }, null, null],
    };
    vi.mocked(loadTs.loadStepsFromTs).mockResolvedValue(mockSteps);
    // Only the presenter manifest exists for this scenario.
    vi.mocked(fs.access).mockImplementation((path) =>
      String(path).includes(join("presenter", "manifest.json"))
        ? Promise.resolve()
        : Promise.reject(new Error("ENOENT")),
    );
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(presenterManifest) as never);

    const bundle = await loadBundle("/fake/scenarios/presented-demo");
    expect(bundle.presenterManifest).toEqual(presenterManifest);
    expect(bundle.narrationManifest).toBeUndefined();
  });

  it("leaves the presenter manifest undefined when none exists", async () => {
    vi.mocked(loadTs.loadStepsFromTs).mockResolvedValue(mockSteps);
    vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));

    const bundle = await loadBundle("/fake/scenarios/plain-demo");
    expect(bundle.presenterManifest).toBeUndefined();
  });

  it("carries the authored soundtrack from the steps module", async () => {
    const soundtrack = { musicSrc: "./soundtrack/music.mp3", sfx: true };
    vi.mocked(loadTs.loadStepsFromTs).mockResolvedValue(mockSteps);
    vi.mocked(loadTs.loadSoundtrackFromTs).mockResolvedValue(soundtrack);
    vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));

    const bundle = await loadBundle("/fake/scenarios/scored-demo");
    expect(bundle.soundtrack).toEqual(soundtrack);
  });

  it("leaves soundtrack undefined when the module authors none", async () => {
    vi.mocked(loadTs.loadStepsFromTs).mockResolvedValue(mockSteps);
    vi.mocked(loadTs.loadSoundtrackFromTs).mockResolvedValue(null);
    vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));

    const bundle = await loadBundle("/fake/scenarios/silent-demo");
    expect(bundle.soundtrack).toBeUndefined();
  });

  it("carries authored title cards without synthesizing card steps", async () => {
    const titleCards = { intro: { title: "Acme" }, outro: { title: "Bye" } };
    vi.mocked(loadTs.loadStepsFromTs).mockResolvedValue(mockSteps);
    vi.mocked(loadTs.loadTitleCardsFromTs).mockResolvedValue(titleCards);
    vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));

    const bundle = await loadBundle("/fake/scenarios/framed-demo");
    expect(bundle.titleCards).toEqual(titleCards);
    // The CLI bundle carries the AUTHORED shape — expansion happens in the
    // generated entries, so the steps stay exactly as written.
    expect(bundle.steps).toHaveLength(3);
  });

  it("leaves titleCards undefined when the module authors none", async () => {
    vi.mocked(loadTs.loadStepsFromTs).mockResolvedValue(mockSteps);
    vi.mocked(loadTs.loadTitleCardsFromTs).mockResolvedValue(null);
    vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));

    const bundle = await loadBundle("/fake/scenarios/plain-demo");
    expect(bundle.titleCards).toBeUndefined();
  });

  it("carries the authored viewport from the steps module (scenar#29)", async () => {
    vi.mocked(loadTs.loadStepsFromTs).mockResolvedValue(mockSteps);
    vi.mocked(loadTs.loadViewportFromTs).mockResolvedValue({ width: 1440, height: 900 });
    vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));

    const bundle = await loadBundle("/fake/scenarios/sized-demo");
    expect(bundle.viewport).toEqual({ width: 1440, height: 900 });
  });

  it("leaves viewport undefined when the module authors none", async () => {
    vi.mocked(loadTs.loadStepsFromTs).mockResolvedValue(mockSteps);
    vi.mocked(loadTs.loadViewportFromTs).mockResolvedValue(null);
    vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));

    const bundle = await loadBundle("/fake/scenarios/plain-demo");
    expect(bundle.viewport).toBeUndefined();
  });
});
