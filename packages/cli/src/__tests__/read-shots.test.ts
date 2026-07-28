import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readBundleShots } from "../bundle/read-shots.js";

describe("readBundleShots", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "scenar-shots-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function writeScenarioJson(content: unknown): Promise<void> {
    await writeFile(
      join(dir, "scenario.json"),
      typeof content === "string" ? content : JSON.stringify(content),
      "utf-8",
    );
  }

  it("reads the recorded shot names from scenario.json", async () => {
    await writeScenarioJson({ schemaVersion: "1", id: "x", shots: ["opening", "detail-open"] });
    expect(await readBundleShots(dir)).toEqual({
      recorded: true,
      shots: ["opening", "detail-open"],
    });
  });

  it("treats a recorded empty list as authoritative", async () => {
    await writeScenarioJson({ schemaVersion: "1", id: "x", shots: [] });
    expect(await readBundleShots(dir)).toEqual({ recorded: true, shots: [] });
  });

  it("reports unknown when scenario.json is absent", async () => {
    expect(await readBundleShots(dir)).toEqual({ recorded: false });
  });

  it("reports unknown when the key is missing or malformed", async () => {
    // A pre-shots bundle (generator < 0.0.2) simply has no key.
    await writeScenarioJson({ schemaVersion: "1", id: "x" });
    expect(await readBundleShots(dir)).toEqual({ recorded: false });

    await writeScenarioJson({ schemaVersion: "1", id: "x", shots: "opening" });
    expect(await readBundleShots(dir)).toEqual({ recorded: false });

    await writeScenarioJson({ schemaVersion: "1", id: "x", shots: [1, 2] });
    expect(await readBundleShots(dir)).toEqual({ recorded: false });

    await writeScenarioJson("{ not json");
    expect(await readBundleShots(dir)).toEqual({ recorded: false });
  });
});
