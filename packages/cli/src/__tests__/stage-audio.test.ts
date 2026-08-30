import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { stageRenderAudio } from "../render/stage-audio.js";
import {
  SFX_DEST_PATHS,
  isRemoteUrl,
  resolveMusicAsset,
  resolveSfxAssetPaths,
} from "../util/soundtrack-assets.js";

let scenarioDir: string;
let publicDir: string;

beforeEach(async () => {
  scenarioDir = await mkdtemp(join(tmpdir(), "scenar-stage-"));
  publicDir = join(scenarioDir, ".scenar-render", "public");
});

afterEach(async () => {
  await rm(scenarioDir, { recursive: true, force: true });
});

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}

describe("stageRenderAudio", () => {
  it("stages narration clips flat at the public root (srcs are ./step-N.mp3)", async () => {
    await mkdir(join(scenarioDir, "narration"), { recursive: true });
    await writeFile(join(scenarioDir, "narration", "step-0.mp3"), "audio-0");
    await writeFile(join(scenarioDir, "narration", "step-2.mp3"), "audio-2");
    await writeFile(join(scenarioDir, "narration", "manifest.json"), "{}");

    const staged = await stageRenderAudio({
      scenarioDir,
      publicDir,
      hasNarration: true,
    });

    expect(staged).toBe(2);
    expect(await readFile(join(publicDir, "step-0.mp3"), "utf-8")).toBe("audio-0");
    expect(await readFile(join(publicDir, "step-2.mp3"), "utf-8")).toBe("audio-2");
    // The manifest itself is imported by the entry, never served.
    expect(await exists(join(publicDir, "manifest.json"))).toBe(false);
  });

  it("stages the music asset at its scenario-relative path", async () => {
    await mkdir(join(scenarioDir, "soundtrack"), { recursive: true });
    await writeFile(join(scenarioDir, "soundtrack", "music.mp3"), "music-bytes");

    const staged = await stageRenderAudio({
      scenarioDir,
      publicDir,
      hasNarration: false,
      soundtrack: { musicSrc: "./soundtrack/music.mp3" },
    });

    expect(staged).toBe(1);
    expect(await readFile(join(publicDir, "soundtrack", "music.mp3"), "utf-8")).toBe(
      "music-bytes",
    );
  });

  it("stages the built-in SFX set at the shared destinations", async () => {
    const clickSource = join(scenarioDir, "fake-click.mp3");
    const keystrokeSource = join(scenarioDir, "fake-keystroke.mp3");
    await writeFile(clickSource, "click-bytes");
    await writeFile(keystrokeSource, "keystroke-bytes");

    const staged = await stageRenderAudio({
      scenarioDir,
      publicDir,
      hasNarration: false,
      soundtrack: { sfx: true },
      sfxPaths: { click: clickSource, keystroke: keystrokeSource },
    });

    expect(staged).toBe(2);
    expect(await readFile(join(publicDir, SFX_DEST_PATHS.click), "utf-8")).toBe("click-bytes");
    expect(await readFile(join(publicDir, SFX_DEST_PATHS.keystroke), "utf-8")).toBe(
      "keystroke-bytes",
    );
  });

  it("stages nothing (and reports zero) for a silent scenario", async () => {
    const staged = await stageRenderAudio({
      scenarioDir,
      publicDir,
      hasNarration: false,
    });
    expect(staged).toBe(0);
    expect(await exists(publicDir)).toBe(false);
  });

  it("skips remote music URLs — they are referenced, not copied", async () => {
    const staged = await stageRenderAudio({
      scenarioDir,
      publicDir,
      hasNarration: false,
      soundtrack: { musicSrc: "https://cdn.example.com/music.mp3" },
    });
    expect(staged).toBe(0);
  });

  it("fails loudly when the music file is missing (a silent render otherwise)", async () => {
    await expect(
      stageRenderAudio({
        scenarioDir,
        publicDir,
        hasNarration: false,
        soundtrack: { musicSrc: "./soundtrack/missing.mp3" },
      }),
    ).rejects.toThrow(/not found/);
  });
});

describe("resolveMusicAsset", () => {
  it("rejects paths escaping the scenario directory", async () => {
    await expect(resolveMusicAsset(scenarioDir, "../outside.mp3")).rejects.toThrow(
      /outside the scenario directory/,
    );
  });

  it("returns null for remote URLs", async () => {
    expect(await resolveMusicAsset(scenarioDir, "https://cdn.example.com/a.mp3")).toBeNull();
  });
});

describe("isRemoteUrl", () => {
  it.each([
    ["https://cdn.example.com/a.mp3", true],
    ["http://x/a.mp3", true],
    ["./soundtrack/music.mp3", false],
    ["soundtrack/music.mp3", false],
  ])("%s -> %s", (src, expected) => {
    expect(isRemoteUrl(src)).toBe(expected);
  });
});

describe("resolveSfxAssetPaths", () => {
  it("resolves the real assets from a workspace context", async () => {
    // This test file lives inside the repo, where @scenar/react is
    // installed — the same resolution a consumer project gets.
    const fromDir = dirname(fileURLToPath(import.meta.url));
    const paths = resolveSfxAssetPaths(fromDir);
    expect(await exists(paths.click)).toBe(true);
    expect(await exists(paths.keystroke)).toBe(true);
  });
});
