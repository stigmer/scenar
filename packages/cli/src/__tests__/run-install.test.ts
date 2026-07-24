import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runInstall,
  parseSpec,
  detectPackageManager,
  findWorkspaceRoot,
} from "../install/run-install.js";

const silent = () => {};

describe("parseSpec", () => {
  const cwd = "/tmp/does-not-matter";

  it("parses a bare name", () => {
    expect(parseSpec("react", cwd)).toEqual({ name: "react", range: "" });
  });

  it("parses a scoped bare name", () => {
    expect(parseSpec("@stigmer/react", cwd)).toEqual({
      name: "@stigmer/react",
      range: "",
    });
  });

  it("parses name@range", () => {
    expect(parseSpec("react@^19.0.0", cwd)).toEqual({
      name: "react",
      range: "^19.0.0",
    });
  });

  it("parses @scope/name@range", () => {
    expect(parseSpec("@stigmer/react@1.2.0", cwd)).toEqual({
      name: "@stigmer/react",
      range: "1.2.0",
    });
  });

  it("rejects git/URL specs without a name", () => {
    expect(() => parseSpec("git+https://example.com/x.git", cwd)).toThrow(
      /no package name/,
    );
  });
});

describe("detectPackageManager", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "scenar-pm-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("defaults to npm when no lockfile is present", () => {
    expect(detectPackageManager(dir)).toBe("npm");
  });

  it("detects pnpm", async () => {
    await writeFile(join(dir, "pnpm-lock.yaml"), "", "utf-8");
    expect(detectPackageManager(dir)).toBe("pnpm");
  });

  it("detects yarn", async () => {
    await writeFile(join(dir, "yarn.lock"), "", "utf-8");
    expect(detectPackageManager(dir)).toBe("yarn");
  });

  it("detects npm from package-lock.json", async () => {
    await writeFile(join(dir, "package-lock.json"), "{}", "utf-8");
    expect(detectPackageManager(dir)).toBe("npm");
  });
});

describe("findWorkspaceRoot", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "scenar-ws-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("detects a member via pnpm-workspace.yaml globs", async () => {
    await writeFile(
      join(root, "pnpm-workspace.yaml"),
      "packages:\n  - 'packages/*'\n",
      "utf-8",
    );
    const member = join(root, "packages", "demos");
    await mkdir(member, { recursive: true });
    expect(findWorkspaceRoot(member)).toBe(root);
  });

  it("detects a member via package.json workspaces", async () => {
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "root", workspaces: ["apps/*"] }),
      "utf-8",
    );
    const member = join(root, "apps", "web");
    await mkdir(member, { recursive: true });
    expect(findWorkspaceRoot(member)).toBe(root);
  });

  it("returns null for a standalone directory", async () => {
    const standalone = join(root, "standalone");
    await mkdir(standalone, { recursive: true });
    expect(findWorkspaceRoot(standalone)).toBeNull();
  });
});

describe("runInstall (skipInstall)", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "scenar-install-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function readPkg(d: string) {
    return JSON.parse(await readFile(join(d, "package.json"), "utf-8"));
  }

  it("scaffolds a fresh project with a runnable starter tour", () => {
    const result = runInstall({ cwd: dir, packages: [], onLog: silent, skipInstall: true });
    expect(result.scaffolded).toBe(true);
    expect(existsSync(join(dir, "package.json"))).toBe(true);
    expect(existsSync(join(dir, ".gitignore"))).toBe(true);
    expect(existsSync(join(dir, "tsconfig.json"))).toBe(true);
    expect(existsSync(join(dir, "tours/example-tour/steps.ts"))).toBe(true);
    expect(existsSync(join(dir, "tours/example-tour/index.tsx"))).toBe(true);
    expect(existsSync(join(dir, "tours/example-tour/.scenar/providers.tsx"))).toBe(true);
  });

  it("records a bare package as '*'", async () => {
    runInstall({ cwd: dir, packages: ["@stigmer/react"], onLog: silent, skipInstall: true });
    const pkg = await readPkg(dir);
    expect(pkg.dependencies["@stigmer/react"]).toBe("*");
  });

  it("records an explicit range", async () => {
    runInstall({ cwd: dir, packages: ["@stigmer/react@^1.2.0"], onLog: silent, skipInstall: true });
    const pkg = await readPkg(dir);
    expect(pkg.dependencies["@stigmer/react"]).toBe("^1.2.0");
  });

  it("does not clobber an existing pin when given a bare name", async () => {
    runInstall({ cwd: dir, packages: ["@stigmer/react@^1.2.0"], onLog: silent, skipInstall: true });
    runInstall({ cwd: dir, packages: ["@stigmer/react"], onLog: silent, skipInstall: true });
    const pkg = await readPkg(dir);
    expect(pkg.dependencies["@stigmer/react"]).toBe("^1.2.0");
  });

  it("resolves a file: spec's name from its target package.json", async () => {
    const lib = join(dir, "..", `lib-${Date.now()}`);
    await mkdir(lib, { recursive: true });
    await writeFile(
      join(lib, "package.json"),
      JSON.stringify({ name: "@local/lib", version: "0.0.0" }),
      "utf-8",
    );
    try {
      runInstall({
        cwd: dir,
        packages: [`file:${lib}`],
        onLog: silent,
        skipInstall: true,
      });
      const pkg = await readPkg(dir);
      expect(pkg.dependencies["@local/lib"]).toBe(`file:${lib}`);
    } finally {
      await rm(lib, { recursive: true, force: true });
    }
  });

  it("uses workspace:* for a workspace member under pnpm", async () => {
    const root = await mkdtemp(join(tmpdir(), "scenar-ws-install-"));
    try {
      await writeFile(join(root, "pnpm-lock.yaml"), "", "utf-8");
      await writeFile(
        join(root, "pnpm-workspace.yaml"),
        "packages:\n  - 'packages/*'\n",
        "utf-8",
      );
      const reactPkg = join(root, "packages", "react");
      await mkdir(reactPkg, { recursive: true });
      await writeFile(
        join(reactPkg, "package.json"),
        JSON.stringify({ name: "@stigmer/react", version: "0.0.0" }),
        "utf-8",
      );
      const demos = join(root, "packages", "demos");
      await mkdir(demos, { recursive: true });

      const result = runInstall({
        cwd: demos,
        packages: ["@stigmer/react"],
        onLog: silent,
        skipInstall: true,
      });

      expect(result.workspaceRoot).toBe(root);
      expect(result.packageManager).toBe("pnpm");
      const pkg = await readPkg(demos);
      expect(pkg.dependencies["@stigmer/react"]).toBe("workspace:*");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
