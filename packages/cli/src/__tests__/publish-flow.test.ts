import { describe, it, expect, vi } from "vitest";
import {
  runPublishFlow,
  validateRepoName,
  validatePublishPath,
  normalizePath,
  pagesUrl,
  repoUrl,
  type PublishFlowDeps,
} from "../publish/publish-flow.js";

/** A deps double whose every method records its call order. */
function makeDeps(overrides: Partial<PublishFlowDeps> = {}): {
  deps: PublishFlowDeps;
  calls: string[];
} {
  const calls: string[] = [];
  const deps: PublishFlowDeps = {
    ensureToolsAvailable: vi.fn(async () => {
      calls.push("ensureTools");
    }),
    resolveOwner: vi.fn(async (org) => {
      calls.push(`resolveOwner:${org ?? "<user>"}`);
      return org ?? "octocat";
    }),
    repoExists: vi.fn(async () => {
      calls.push("repoExists");
      return false;
    }),
    createRepo: vi.fn(async (_owner, _repo, opts) => {
      calls.push(`createRepo:${opts.private ? "private" : "public"}`);
    }),
    pushBundleToPages: vi.fn(async () => {
      calls.push("push");
    }),
    enablePages: vi.fn(async () => {
      calls.push("enablePages");
    }),
    log: () => {},
    ...overrides,
  };
  return { deps, calls };
}

describe("runPublishFlow", () => {
  it("creates a new repo, pushes, and enables pages in order", async () => {
    const { deps, calls } = makeDeps();
    const result = await runPublishFlow(deps, {
      bundleDir: "/tmp/bundle",
      repo: "welcome-tour",
      path: "",
      private: false,
      message: "Publish Scenar embed",
    });

    expect(calls).toEqual([
      "ensureTools",
      "resolveOwner:<user>",
      "repoExists",
      "createRepo:public",
      "push",
      "enablePages",
    ]);
    expect(result).toEqual({
      owner: "octocat",
      repo: "welcome-tour",
      path: "",
      repoUrl: "https://github.com/octocat/welcome-tour",
      pagesUrl: "https://octocat.github.io/welcome-tour/",
      created: true,
    });
  });

  it("publishes into a subpath and reflects it in the URL + push payload", async () => {
    const { deps } = makeDeps({ repoExists: vi.fn(async () => true) });
    const result = await runPublishFlow(deps, {
      bundleDir: "/tmp/bundle",
      repo: "scenar-embeds",
      path: "welcome-tour",
      private: false,
      message: "m",
    });

    expect(deps.pushBundleToPages).toHaveBeenCalledWith(
      expect.objectContaining({ repo: "scenar-embeds", path: "welcome-tour" }),
    );
    expect(result.path).toBe("welcome-tour");
    expect(result.pagesUrl).toBe("https://octocat.github.io/scenar-embeds/welcome-tour/");
  });

  it("reuses an existing repo (no create) and reports created: false", async () => {
    const { deps, calls } = makeDeps({
      repoExists: vi.fn(async () => {
        calls.push("repoExists");
        return true;
      }),
    });
    // calls array is the one closed over by the override too.
    const result = await runPublishFlow(deps, {
      bundleDir: "/tmp/bundle",
      repo: "welcome-tour",
      path: "",
      private: false,
      message: "m",
    });
    expect(deps.createRepo).not.toHaveBeenCalled();
    expect(result.created).toBe(false);
  });

  it("passes the org through as the owner and creates a private repo when asked", async () => {
    const { deps } = makeDeps();
    const result = await runPublishFlow(deps, {
      bundleDir: "/tmp/bundle",
      repo: "demo",
      path: "",
      org: "acme-inc",
      private: true,
      message: "m",
    });
    expect(deps.resolveOwner).toHaveBeenCalledWith("acme-inc");
    expect(deps.createRepo).toHaveBeenCalledWith(
      "acme-inc",
      "demo",
      expect.objectContaining({ private: true }),
    );
    expect(result.owner).toBe("acme-inc");
    expect(result.pagesUrl).toBe("https://acme-inc.github.io/demo/");
  });

  it("does not push or enable pages if tooling is unavailable", async () => {
    const { deps } = makeDeps({
      ensureToolsAvailable: vi.fn(async () => {
        throw new Error("gh not installed");
      }),
    });
    await expect(
      runPublishFlow(deps, { bundleDir: "/x", repo: "r", path: "", private: false, message: "m" }),
    ).rejects.toThrow(/gh not installed/);
    expect(deps.pushBundleToPages).not.toHaveBeenCalled();
    expect(deps.enablePages).not.toHaveBeenCalled();
  });
});

describe("pagesUrl", () => {
  it("serves a normal repo under its name as a path", () => {
    expect(pagesUrl("octocat", "welcome-tour")).toBe("https://octocat.github.io/welcome-tour/");
  });

  it("lowercases the owner in the host", () => {
    expect(pagesUrl("OctoCat", "demo")).toBe("https://octocat.github.io/demo/");
  });

  it("serves the user/org site repo at the apex", () => {
    expect(pagesUrl("octocat", "octocat.github.io")).toBe("https://octocat.github.io/");
  });

  it("appends a non-empty subpath", () => {
    expect(pagesUrl("octocat", "scenar-embeds", "welcome-tour")).toBe(
      "https://octocat.github.io/scenar-embeds/welcome-tour/",
    );
  });

  it("appends a subpath under the user/org site repo too", () => {
    expect(pagesUrl("octocat", "octocat.github.io", "tour")).toBe(
      "https://octocat.github.io/tour/",
    );
  });

  it("ignores an empty/root path", () => {
    expect(pagesUrl("octocat", "demo", "")).toBe("https://octocat.github.io/demo/");
    expect(pagesUrl("octocat", "demo", "/")).toBe("https://octocat.github.io/demo/");
  });
});

describe("normalizePath", () => {
  it("strips leading/trailing/doubled slashes and dots", () => {
    expect(normalizePath("/welcome-tour/")).toBe("welcome-tour");
    expect(normalizePath("a//b/")).toBe("a/b");
    expect(normalizePath("/")).toBe("");
    expect(normalizePath(".")).toBe("");
    expect(normalizePath(undefined)).toBe("");
  });
});

describe("validatePublishPath", () => {
  it("accepts root and safe segments", () => {
    expect(validatePublishPath("")).toBeNull();
    expect(validatePublishPath("welcome-tour")).toBeNull();
    expect(validatePublishPath("demos/v2")).toBeNull();
  });

  it("rejects traversal and illegal characters", () => {
    expect(validatePublishPath("..")).toMatch(/\.\./);
    expect(validatePublishPath("a/../b")).toMatch(/\.\./);
    expect(validatePublishPath("has space")).toMatch(/invalid path segment/);
  });
});

describe("repoUrl", () => {
  it("builds the repository web URL", () => {
    expect(repoUrl("octocat", "demo")).toBe("https://github.com/octocat/demo");
  });
});

describe("validateRepoName", () => {
  it("accepts valid names", () => {
    expect(validateRepoName("welcome-tour")).toBeNull();
    expect(validateRepoName("my_demo.embed")).toBeNull();
    expect(validateRepoName("a")).toBeNull();
  });

  it("rejects empty, over-long, dot, and illegal-character names", () => {
    expect(validateRepoName("")).toMatch(/1-100/);
    expect(validateRepoName("x".repeat(101))).toMatch(/1-100/);
    expect(validateRepoName(".")).toMatch(/"\."/);
    expect(validateRepoName("..")).toMatch(/"\."/);
    expect(validateRepoName("has space")).toMatch(/invalid repo name/);
    expect(validateRepoName("slash/name")).toMatch(/invalid repo name/);
  });
});
