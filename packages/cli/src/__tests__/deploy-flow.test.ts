import { describe, it, expect, vi } from "vitest";
import {
  runDeployFlow,
  toDeclaredFiles,
  localViewUrl,
  type DeployFlowDeps,
  type UploadTarget,
} from "../deploy/deploy-flow.js";
import type { PackManifest } from "../pack/pack-manifest.js";

const MANIFEST: PackManifest = {
  schemaVersion: 1,
  scenarioId: "welcome-tour",
  files: [
    { path: "index.html", sha256: "a".repeat(64), sizeBytes: 397, contentType: "text/html" },
    { path: "assets/app.js", sha256: "b".repeat(64), sizeBytes: 356965, contentType: "text/javascript" },
    { path: "scenario.json", sha256: "c".repeat(64), sizeBytes: 91, contentType: "application/json" },
  ],
};

describe("toDeclaredFiles", () => {
  it("maps manifest files to declared files with bigint sizes and lowercase-hex sha256", () => {
    const declared = toDeclaredFiles(MANIFEST);
    expect(declared).toHaveLength(3);
    expect(declared[0]).toEqual({
      relativePath: "index.html",
      sha256: "a".repeat(64),
      sizeBytes: 397n,
      contentType: "text/html",
    });
    expect(typeof declared[1]!.sizeBytes).toBe("bigint");
    expect(declared[1]!.sizeBytes).toBe(356965n);
  });
});

describe("runDeployFlow", () => {
  it("ensures the scenario before creating the session, then uploads then completes", async () => {
    const calls: string[] = [];
    const targets: UploadTarget[] = [
      {
        relativePath: "index.html",
        presignedPutUrl: "https://store/idx",
        requiredHeaders: { "Content-Type": "text/html", "x-amz-checksum-sha256": "AAAA" },
      },
      {
        relativePath: "assets/app.js",
        presignedPutUrl: "https://store/js",
        requiredHeaders: { "Content-Type": "text/javascript", "x-amz-checksum-sha256": "BBBB" },
      },
    ];

    const uploaded: Array<{ target: UploadTarget; bytes: number }> = [];

    const deps: DeployFlowDeps = {
      applyScenario: vi.fn(async (input) => {
        calls.push("apply");
        expect(input).toEqual({ org: "acme", slug: "welcome-tour", name: "Welcome" });
        return "scn_123";
      }),
      createSession: vi.fn(async (scenarioId, files) => {
        calls.push("create");
        expect(scenarioId).toBe("scn_123");
        expect(files).toHaveLength(3);
        return { deployId: "dep_456", uploadTargets: targets };
      }),
      readBundleFile: vi.fn(async (rel) => new Uint8Array(rel.length)),
      uploadFile: vi.fn(async (target, bytes) => {
        calls.push(`upload:${target.relativePath}`);
        uploaded.push({ target, bytes: bytes.byteLength });
      }),
      completeSession: vi.fn(async (deployId) => {
        calls.push("complete");
        expect(deployId).toBe("dep_456");
        return "https://d-dep_456.localhost:8787/";
      }),
      log: () => {},
    };

    const result = await runDeployFlow(deps, {
      manifest: MANIFEST,
      org: "acme",
      slug: "welcome-tour",
      name: "Welcome",
    });

    expect(result).toEqual({ deployId: "dep_456", embedUrl: "https://d-dep_456.localhost:8787/" });
    // Ordering: ensure -> create -> upload each (in target order) -> complete.
    expect(calls).toEqual(["apply", "create", "upload:index.html", "upload:assets/app.js", "complete"]);
    // Required headers are passed through verbatim to each upload.
    expect(uploaded[0]!.target.requiredHeaders).toEqual(targets[0]!.requiredHeaders);
    expect(uploaded[1]!.target.requiredHeaders).toEqual(targets[1]!.requiredHeaders);
  });

  it("propagates a missing-embed-url failure from completion", async () => {
    const deps: DeployFlowDeps = {
      applyScenario: async () => "scn_1",
      createSession: async () => ({ deployId: "dep_1", uploadTargets: [] }),
      readBundleFile: async () => new Uint8Array(),
      uploadFile: async () => {},
      completeSession: async () => {
        throw new Error("deploy completed but returned no embed_url");
      },
      log: () => {},
    };

    await expect(
      runDeployFlow(deps, { manifest: MANIFEST, org: "acme", slug: "welcome-tour", name: "x" }),
    ).rejects.toThrow(/embed_url/);
  });
});

describe("localViewUrl", () => {
  it("downgrades https to http for *.localhost hosts (wrangler dev serves http)", () => {
    expect(localViewUrl("https://d-abc.localhost:8787/")).toBe("http://d-abc.localhost:8787/");
    expect(localViewUrl("https://localhost:8787/")).toBe("http://localhost:8787/");
  });

  it("leaves production https URLs untouched", () => {
    expect(localViewUrl("https://d-abc.scenar.ai/")).toBe("https://d-abc.scenar.ai/");
  });

  it("returns non-URL input unchanged", () => {
    expect(localViewUrl("not a url")).toBe("not a url");
  });
});
