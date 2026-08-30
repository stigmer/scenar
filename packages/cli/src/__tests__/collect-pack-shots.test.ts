// @vitest-environment node
//
// The workspace default is jsdom, but jsdom's TextEncoder returns a
// Uint8Array from its own realm, which trips esbuild's environment
// invariant when Vite loads. collectPackShots is a pure Node code path
// (it IS what `scenar pack` runs), so it is tested in a Node environment.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectPackShots } from "../pack/collect-pack-shots.js";

/**
 * These tests run the real Vite SSR pipeline against throwaway scenario
 * directories — the same code path `scenar pack` uses — so they are slower
 * than the pure-unit suites but prove the actual contract: what pack records
 * is what the steps module really exports, not a source-text approximation.
 */
describe("collectPackShots", () => {
  let scenarioDir: string;

  beforeEach(async () => {
    scenarioDir = await mkdtemp(join(tmpdir(), "scenar-collect-shots-"));
  });

  afterEach(async () => {
    await rm(scenarioDir, { recursive: true, force: true });
  });

  async function writeSteps(source: string): Promise<void> {
    await writeFile(join(scenarioDir, "steps.ts"), source, "utf-8");
  }

  it("records declared shot names in step order", async () => {
    await writeSteps(
      `export const steps = [
        { delayMs: 0, shot: "opening" },
        { delayMs: 1200 },
        { delayMs: 800, shot: "detail-open" },
      ];`,
    );
    expect(await collectPackShots(scenarioDir)).toEqual({
      recorded: true,
      shots: ["opening", "detail-open"],
      authoredViewport: null,
      authoredSoundtrack: null,
      authoredTitleCards: null,
    });
  });

  it("discovers a shot name built from a constant (runtime truth, not AST)", async () => {
    await writeSteps(
      `const SECTION = "detail";
      export const steps = [{ delayMs: 0, shot: \`\${SECTION}-open\` }];`,
    );
    expect(await collectPackShots(scenarioDir)).toEqual({
      recorded: true,
      shots: ["detail-open"],
      authoredViewport: null,
      authoredSoundtrack: null,
      authoredTitleCards: null,
    });
  });

  it("records an authoritatively empty list for a shot-less scenario", async () => {
    await writeSteps(`export const steps = [{ delayMs: 0 }, { delayMs: 900 }];`);
    expect(await collectPackShots(scenarioDir)).toEqual({
      recorded: true,
      shots: [],
      authoredViewport: null,
      authoredSoundtrack: null,
      authoredTitleCards: null,
    });
  });

  it("discovers the authored viewport alongside the shots (one SSR load)", async () => {
    await writeSteps(
      `export const viewport = { width: 1440, height: 900 };
      export const steps = [{ delayMs: 0, shot: "opening" }];`,
    );
    expect(await collectPackShots(scenarioDir)).toEqual({
      recorded: true,
      shots: ["opening"],
      authoredViewport: { width: 1440, height: 900 },
      authoredSoundtrack: null,
      authoredTitleCards: null,
    });
  });

  it("degrades to recorded:false with the reason when the module cannot be imported", async () => {
    await writeSteps(
      `import { nope } from "./does-not-exist.js";
      export const steps = [{ delayMs: 0, shot: String(nope) }];`,
    );
    const result = await collectPackShots(scenarioDir);
    expect(result.recorded).toBe(false);
    if (!result.recorded) {
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("fails the pack when the module has no delayMs-bearing steps array", async () => {
    await writeSteps(`export const notSteps = { delayMs: 0 };\nexport const nums = [1, 2, 3];`);
    await expect(collectPackShots(scenarioDir)).rejects.toThrow(/No steps array found/);
  });

  it("fails the pack on a duplicate shot name, naming both steps", async () => {
    await writeSteps(
      `export const steps = [
        { delayMs: 0, shot: "opening" },
        { delayMs: 100, shot: "opening" },
      ];`,
    );
    await expect(collectPackShots(scenarioDir)).rejects.toThrow(
      /steps 0 and 1 both declare shot "opening"/,
    );
  });

  it("fails the pack on a non-kebab-case shot name", async () => {
    await writeSteps(`export const steps = [{ delayMs: 0, shot: "Not_Kebab" }];`);
    await expect(collectPackShots(scenarioDir)).rejects.toThrow(/not kebab-case/);
  });
});
