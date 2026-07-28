import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ScenarioShot } from "@scenar/core";
import { STILLS_DIR, runShoot } from "../shoot/run-shoot.js";
import type { PackManifest } from "../pack/pack-manifest.js";
import type { ShotBrowser, ShotTheme } from "../shoot/types.js";

const SHOTS: ScenarioShot[] = [
  { name: "opening", timeMs: 2999, stepIndex: 0 },
  { name: "detail-open", timeMs: 6999, stepIndex: 2 },
];

/**
 * Write the minimal three files that make a directory a shootable bundle.
 * By default scenario.json carries no `shots` key (a pre-0.0.2 bundle:
 * shots unknown, so runShoot must boot the capture page); pass
 * `recordedShots` to emulate a bundle whose pack recorded the list.
 */
async function makeBundle(recordedShots?: readonly string[]): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "scenar-shoot-"));
  await writeFile(join(dir, "index.html"), "<!doctype html><div id='root'></div>", "utf-8");
  await writeFile(
    join(dir, "scenario.json"),
    JSON.stringify({
      schemaVersion: "1",
      id: "lab-tour",
      generator: "@scenar/cli pack 0.0.1",
      viewport: { width: 896, height: 480 },
      ...(recordedShots !== undefined ? { shots: recordedShots } : {}),
    }),
    "utf-8",
  );
  await writeFile(
    join(dir, "pack-manifest.json"),
    JSON.stringify({ schemaVersion: 1, scenarioId: "lab-tour", files: [] }),
    "utf-8",
  );
  return dir;
}

interface FakeKnobs {
  /** Shot list every session reports (default {@link SHOTS}). */
  shots?: ScenarioShot[];
  /** Shot list per theme — for the cross-theme divergence test. */
  shotsFor?: (theme: ShotTheme) => ScenarioShot[];
  /** Error thrown from open() — simulates window.__scenarShotError. */
  openError?: string;
  /** Image bytes per (theme, shot, per-theme session number). */
  imageFor?: (theme: ShotTheme, shotName: string, sessionIndex: number) => Buffer;
}

interface SessionLog {
  theme: ShotTheme;
  url: string;
  walks: number[];
  closed: boolean;
}

/** A ShotBrowser fake that records every interaction for assertions. */
function makeFakeBrowser(knobs: FakeKnobs = {}) {
  const sessions: SessionLog[] = [];
  const perThemeCount = new Map<ShotTheme, number>();
  let browserClosed = false;

  const imageFor =
    knobs.imageFor ??
    ((theme: ShotTheme, shotName: string) => Buffer.from(`png:${theme}:${shotName}`));

  const browser: ShotBrowser = {
    async newSession({ theme }) {
      const sessionIndex = perThemeCount.get(theme) ?? 0;
      perThemeCount.set(theme, sessionIndex + 1);
      const log: SessionLog = { theme, url: "", walks: [], closed: false };
      sessions.push(log);
      const shots = knobs.shotsFor?.(theme) ?? knobs.shots ?? SHOTS;
      let lastWalkedShot = "";
      return {
        async open(url) {
          log.url = url;
          if (knobs.openError) throw new Error(`the capture page reported: ${knobs.openError}`);
          return { shots, frameSelector: "[data-scenar-shot-frame]" };
        },
        async walkTo(timeMs) {
          log.walks.push(timeMs);
          lastWalkedShot = shots.find((s) => s.timeMs === timeMs)?.name ?? "unknown";
        },
        async screenshotFrame() {
          return imageFor(theme, lastWalkedShot, sessionIndex);
        },
        async close() {
          log.closed = true;
        },
      };
    },
    async close() {
      browserClosed = true;
    },
  };

  return { browser, sessions, isClosed: () => browserClosed };
}

async function readManifest(bundleDir: string): Promise<PackManifest> {
  return JSON.parse(await readFile(join(bundleDir, "pack-manifest.json"), "utf-8"));
}

describe("runShoot", () => {
  it("captures every shot per theme, in timeline order, into stills/", async () => {
    const bundleDir = await makeBundle();
    const fake = makeFakeBrowser();

    const result = await runShoot({ bundleDir, browserFactory: async () => fake.browser });

    expect(result.scenarioId).toBe("lab-tour");
    expect(result.shots).toEqual(SHOTS);
    expect(result.files).toEqual([
      "stills/opening.light.png",
      "stills/detail-open.light.png",
      "stills/opening.dark.png",
      "stills/detail-open.dark.png",
    ]);
    // One session per theme, each walking the timeline in order.
    expect(fake.sessions.map((s) => s.theme)).toEqual(["light", "dark"]);
    for (const session of fake.sessions) {
      expect(session.walks).toEqual([2999, 6999]);
      expect(session.closed).toBe(true);
    }
    expect(fake.isClosed()).toBe(true);
    // The written bytes are the session's screenshots.
    const opening = await readFile(join(bundleDir, STILLS_DIR, "opening.light.png"));
    expect(opening.toString()).toBe("png:light:opening");
  });

  it("passes ?shot to every session and adds ?theme=dark only for dark", async () => {
    const bundleDir = await makeBundle();
    const fake = makeFakeBrowser();

    await runShoot({ bundleDir, browserFactory: async () => fake.browser });

    const [light, dark] = fake.sessions;
    expect(light!.url).toMatch(/\?shot$/);
    expect(dark!.url).toMatch(/\?shot&theme=dark$/);
  });

  it("rebuilds the pack manifest so deploys ship the stills", async () => {
    const bundleDir = await makeBundle();
    const fake = makeFakeBrowser();

    await runShoot({ bundleDir, browserFactory: async () => fake.browser });

    const manifest = await readManifest(bundleDir);
    const stillEntries = manifest.files.filter((f) => f.path.startsWith("stills/"));
    expect(stillEntries.map((f) => f.path).sort()).toEqual([
      "stills/detail-open.dark.png",
      "stills/detail-open.light.png",
      "stills/opening.dark.png",
      "stills/opening.light.png",
    ]);
    for (const entry of stillEntries) {
      expect(entry.contentType).toBe("image/png");
    }
    // Declared-then-verified: the recorded sha256 is the file's real hash.
    const opening = stillEntries.find((f) => f.path === "stills/opening.light.png")!;
    expect(opening.sha256).toBe(
      createHash("sha256").update(Buffer.from("png:light:opening")).digest("hex"),
    );
    // The bundle's own files are (re)listed too.
    expect(manifest.files.some((f) => f.path === "index.html")).toBe(true);
  });

  it("clears stale stills and rebuilds the manifest even when no shots are declared", async () => {
    const bundleDir = await makeBundle();
    await mkdir(join(bundleDir, STILLS_DIR), { recursive: true });
    await writeFile(join(bundleDir, STILLS_DIR, "removed-shot.light.png"), "stale");
    const fake = makeFakeBrowser({ shots: [] });

    const result = await runShoot({ bundleDir, browserFactory: async () => fake.browser });

    expect(result.shots).toEqual([]);
    expect(result.files).toEqual([]);
    // The stale still is gone from disk AND from the manifest — a manifest
    // listing a deleted file would fail its existence check at publish.
    expect(await stat(join(bundleDir, STILLS_DIR)).catch(() => null)).toBeNull();
    const manifest = await readManifest(bundleDir);
    expect(manifest.files.some((f) => f.path.startsWith("stills/"))).toBe(false);
  });

  it("skips the browser entirely when scenario.json records an empty shot list", async () => {
    const bundleDir = await makeBundle([]);
    await mkdir(join(bundleDir, STILLS_DIR), { recursive: true });
    await writeFile(join(bundleDir, STILLS_DIR, "removed-shot.light.png"), "stale");
    let browserRequested = false;

    const result = await runShoot({
      bundleDir,
      browserFactory: async () => {
        browserRequested = true;
        throw new Error("the short-circuit must return before the browser factory");
      },
    });

    // Pack's record is authoritative: no session, no browser, same outcome.
    expect(browserRequested).toBe(false);
    expect(result).toEqual({
      scenarioId: "lab-tour",
      bundleDir,
      shots: [],
      files: [],
      themes: ["light", "dark"],
      verified: false,
    });
    // Both invariants hold on the short-circuit path too: stale stills are
    // cleared, and the manifest is rebuilt so it never lists deleted files.
    expect(await stat(join(bundleDir, STILLS_DIR)).catch(() => null)).toBeNull();
    const manifest = await readManifest(bundleDir);
    expect(manifest.files.some((f) => f.path.startsWith("stills/"))).toBe(false);
  });

  it("still boots the capture page when scenario.json records a non-empty list", async () => {
    // The record proves there is something to shoot; the running bundle
    // remains the runtime truth for what actually gets captured.
    const bundleDir = await makeBundle(SHOTS.map((s) => s.name));
    const fake = makeFakeBrowser();

    const result = await runShoot({ bundleDir, browserFactory: async () => fake.browser });

    expect(fake.sessions.length).toBeGreaterThan(0);
    expect(result.shots).toEqual(SHOTS);
  });

  it("captures a single theme when asked", async () => {
    const bundleDir = await makeBundle();
    const fake = makeFakeBrowser();

    const result = await runShoot({
      bundleDir,
      themes: ["light"],
      browserFactory: async () => fake.browser,
    });

    expect(result.files).toEqual(["stills/opening.light.png", "stills/detail-open.light.png"]);
    expect(fake.sessions).toHaveLength(1);
  });

  it("surfaces the capture page's own error (e.g. invalid shot declarations)", async () => {
    const bundleDir = await makeBundle();
    const fake = makeFakeBrowser({
      openError: 'steps 0 and 2 both declare shot "opening"; shot names must be unique within a scenario',
    });

    await expect(
      runShoot({ bundleDir, browserFactory: async () => fake.browser }),
    ).rejects.toThrow(/steps 0 and 2 both declare shot "opening"/);
    // The browser is still torn down on the failure path.
    expect(fake.isClosed()).toBe(true);
  });

  it("verify: passes when a second fresh session reproduces every byte", async () => {
    const bundleDir = await makeBundle();
    // Image content ignores the session index — deterministic.
    const fake = makeFakeBrowser();

    const result = await runShoot({
      bundleDir,
      verify: true,
      browserFactory: async () => fake.browser,
    });

    expect(result.verified).toBe(true);
    // Two sessions per theme: capture + verify, all fresh.
    expect(fake.sessions.map((s) => s.theme)).toEqual(["light", "dark", "light", "dark"]);
  });

  it("verify: fails naming the differing shot when sessions disagree", async () => {
    const bundleDir = await makeBundle();
    const fake = makeFakeBrowser({
      imageFor: (theme, shotName, sessionIndex) =>
        // "detail-open" renders differently on every session — the exact
        // nondeterminism --verify exists to catch.
        Buffer.from(
          shotName === "detail-open"
            ? `png:${theme}:${shotName}:${sessionIndex}`
            : `png:${theme}:${shotName}`,
        ),
    });

    await expect(
      runShoot({ bundleDir, verify: true, browserFactory: async () => fake.browser }),
    ).rejects.toThrow(/determinism check failed \(light\): shot\(s\) detail-open differed/);
    // Nothing was written: a failed verify must not leave untrusted stills.
    expect(await stat(join(bundleDir, STILLS_DIR)).catch(() => null)).toBeNull();
  });

  it("fails when themes disagree on the shot list (bundle nondeterminism)", async () => {
    const bundleDir = await makeBundle();
    const fake = makeFakeBrowser({
      shotsFor: (theme) => (theme === "dark" ? SHOTS.slice(0, 1) : SHOTS),
    });

    await expect(
      runShoot({ bundleDir, browserFactory: async () => fake.browser }),
    ).rejects.toThrow(/different shot list/);
  });

  it("rejects a directory that is not a packed bundle, with the fix named", async () => {
    const dir = await mkdtemp(join(tmpdir(), "scenar-shoot-notbundle-"));
    await writeFile(join(dir, "index.html"), "<!doctype html>", "utf-8");

    const fake = makeFakeBrowser();
    await expect(
      runShoot({ bundleDir: dir, browserFactory: async () => fake.browser }),
    ).rejects.toThrow(/no scenario\.json in .*Run `scenar pack`/);
    // Validation fails before any browser work.
    expect(fake.sessions).toHaveLength(0);
  });
});
