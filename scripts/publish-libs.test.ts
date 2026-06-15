import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PACKAGES } from "./publish-libs.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Workspace package globs, read from pnpm-workspace.yaml (simple list form). */
function workspaceGlobs(): string[] {
  const yaml = readFileSync(resolve(repoRoot, "pnpm-workspace.yaml"), "utf8");
  return [...yaml.matchAll(/^\s*-\s*['"]?([^'"\s]+)['"]?\s*$/gm)].map((m) => m[1]);
}

/** Expand a workspace glob to package directories (supports a trailing `/*`). */
function expandGlob(glob: string): string[] {
  if (glob.endsWith("/*")) {
    const base = glob.slice(0, -2);
    return readdirSync(resolve(repoRoot, base), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `${base}/${entry.name}`);
  }
  return [glob];
}

/** Relative dirs of every workspace package marked `publishConfig.access: public`. */
function publicWorkspacePackages(): string[] {
  const dirs: string[] = [];
  for (const glob of workspaceGlobs()) {
    for (const dir of expandGlob(glob)) {
      const pkgPath = resolve(repoRoot, dir, "package.json");
      if (!existsSync(pkgPath)) continue;
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      if (pkg.publishConfig?.access === "public") dirs.push(dir);
    }
  }
  return dirs.sort();
}

describe("publish-libs PACKAGES", () => {
  // Guards the lockstep release: a workspace package marked public but missing
  // from PACKAGES would publish a sibling that depends on an unpublished
  // version (the exact @scenar/cli -> @scenar/stubs gap this test was added for).
  it("covers exactly the public workspace packages", () => {
    expect([...PACKAGES].sort()).toEqual(publicWorkspacePackages());
  });
});
