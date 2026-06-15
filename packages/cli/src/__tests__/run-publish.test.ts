import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPublish } from "../publish/run-publish.js";
import type { PublishFlowDeps } from "../publish/publish-flow.js";

/** Fake gh/git deps: record calls, never touch the network. */
function fakeDeps(): Omit<PublishFlowDeps, "log"> {
  return {
    ensureToolsAvailable: vi.fn(async () => {}),
    resolveOwner: vi.fn(async (org) => org ?? "octocat"),
    repoExists: vi.fn(async () => false),
    createRepo: vi.fn(async () => {}),
    pushBundleToPages: vi.fn(async () => {}),
    enablePages: vi.fn(async () => {}),
  };
}

describe("runPublish", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "scenar-publish-bundle-"));
    await writeFile(join(dir, "index.html"), "<!doctype html><title>t</title>", "utf-8");
    await writeFile(
      join(dir, "scenario.json"),
      JSON.stringify({ schemaVersion: "1", id: "welcome-tour", viewport: { width: 896, height: 480 } }),
      "utf-8",
    );
    await writeFile(
      join(dir, "pack-manifest.json"),
      JSON.stringify({ schemaVersion: 1, scenarioId: "welcome-tour", files: [{ path: "index.html", sha256: "a".repeat(64), sizeBytes: 30, contentType: "text/html" }] }),
      "utf-8",
    );
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("defaults to the shared repo + scenario-slug subpath and returns the URL + snippet", async () => {
    const deps = fakeDeps();
    const { result, snippet, recordedViewport } = await runPublish({ bundleDir: dir, deps });

    expect(result.repo).toBe("scenar-embeds");
    expect(result.path).toBe("welcome-tour");
    expect(result.pagesUrl).toBe("https://octocat.github.io/scenar-embeds/welcome-tour/");
    expect(deps.createRepo).toHaveBeenCalledWith(
      "octocat",
      "scenar-embeds",
      expect.objectContaining({ private: false }),
    );
    expect(deps.pushBundleToPages).toHaveBeenCalledWith(
      expect.objectContaining({ path: "welcome-tour" }),
    );
    expect(recordedViewport).toBe(true);
    expect(snippet).toContain("https://octocat.github.io/scenar-embeds/welcome-tour/");
    expect(snippet).toContain("aspect-ratio:896/480");
  });

  it("honors an explicit repo + org, defaulting the path to the slug", async () => {
    const deps = fakeDeps();
    const { result } = await runPublish({ bundleDir: dir, repo: "tours", org: "stigmer", deps });
    expect(result.pagesUrl).toBe("https://stigmer.github.io/tours/welcome-tour/");
  });

  it("publishes at the repo root when --path is /", async () => {
    const deps = fakeDeps();
    const { result } = await runPublish({ bundleDir: dir, repo: "scenar-welcome-tour", org: "stigmer", path: "/", deps });
    expect(result.path).toBe("");
    expect(result.pagesUrl).toBe("https://stigmer.github.io/scenar-welcome-tour/");
    expect(deps.pushBundleToPages).toHaveBeenCalledWith(expect.objectContaining({ path: "" }));
  });

  it("rejects an invalid explicit path before any GitHub call", async () => {
    const deps = fakeDeps();
    await expect(runPublish({ bundleDir: dir, path: "../escape", deps })).rejects.toThrow(/\.\./);
    expect(deps.ensureToolsAvailable).not.toHaveBeenCalled();
  });

  it("rejects an invalid explicit repo name before any GitHub call", async () => {
    const deps = fakeDeps();
    await expect(runPublish({ bundleDir: dir, repo: "bad name", deps })).rejects.toThrow(/invalid repo name/);
    expect(deps.ensureToolsAvailable).not.toHaveBeenCalled();
  });

  it("fails clearly when the bundle has no index.html", async () => {
    await rm(join(dir, "index.html"));
    await expect(runPublish({ bundleDir: dir, deps: fakeDeps() })).rejects.toThrow(/no index\.html/);
  });
});
