import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readBundleViewport } from "../bundle/read-viewport.js";
import { DEFAULT_VIEWPORT } from "../pack/viewport.js";

describe("readBundleViewport", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "scenar-viewport-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("reads the recorded viewport from scenario.json", async () => {
    await writeFile(
      join(dir, "scenario.json"),
      JSON.stringify({ schemaVersion: "1", id: "x", viewport: { width: 1280, height: 720 } }),
      "utf-8",
    );
    expect(await readBundleViewport(dir)).toEqual({
      viewport: { width: 1280, height: 720 },
      recorded: true,
    });
  });

  it("falls back to the default when scenario.json is absent", async () => {
    expect(await readBundleViewport(dir)).toEqual({
      viewport: DEFAULT_VIEWPORT,
      recorded: false,
    });
  });

  it("falls back to the default when the viewport is missing or malformed", async () => {
    await writeFile(join(dir, "scenario.json"), JSON.stringify({ schemaVersion: "1" }), "utf-8");
    expect(await readBundleViewport(dir)).toEqual({ viewport: DEFAULT_VIEWPORT, recorded: false });

    await writeFile(join(dir, "scenario.json"), "{ not json", "utf-8");
    expect(await readBundleViewport(dir)).toEqual({ viewport: DEFAULT_VIEWPORT, recorded: false });
  });
});
