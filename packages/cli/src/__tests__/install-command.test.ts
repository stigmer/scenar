import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProgram } from "../index.js";

describe("scenar install (command surface)", () => {
  beforeEach(() => {
    process.exitCode = undefined;
  });

  it("registers the install command", () => {
    const program = createProgram();
    const cmd = program.commands.find((c) => c.name() === "install");
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain("Bootstrap a Scenar demos project");
  });

  it("takes variadic packages and exposes its options", () => {
    const program = createProgram();
    const cmd = program.commands.find((c) => c.name() === "install");
    expect(cmd!.registeredArguments).toHaveLength(1);
    expect(cmd!.registeredArguments[0]!.variadic).toBe(true);
    const opts = cmd!.options.map((o) => o.long);
    expect(opts).toContain("--dir");
    expect(opts).toContain("--no-install");
    expect(opts).toContain("--package-manager");
  });
});

describe("scenar install (end-to-end, --no-install)", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "scenar-install-cmd-"));
    process.exitCode = undefined;
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  async function runInstallCommand(args: string[]): Promise<void> {
    const program = createProgram();
    program.exitOverride();
    try {
      await program.parseAsync(["node", "scenar", "install", ...args]);
    } catch {
      // commander throws under exitOverride; assertions cover the outcome
    }
  }

  it("scaffolds a runnable starter tour on first run", async () => {
    await runInstallCommand(["--no-install", "--dir", dir]);

    expect(process.exitCode).not.toBe(1);
    expect(existsSync(join(dir, "package.json"))).toBe(true);
    expect(existsSync(join(dir, "tsconfig.json"))).toBe(true);
    expect(existsSync(join(dir, ".gitignore"))).toBe(true);
    expect(existsSync(join(dir, "tours/example-tour/steps.ts"))).toBe(true);
    expect(existsSync(join(dir, "tours/example-tour/index.tsx"))).toBe(true);
    expect(existsSync(join(dir, "tours/example-tour/.scenar/providers.tsx"))).toBe(true);

    const index = await readFile(join(dir, "tours/example-tour/index.tsx"), "utf-8");
    expect(index).toContain("renderStep");
  });

  it("never overwrites authored files on re-run", async () => {
    await runInstallCommand(["--no-install", "--dir", dir]);

    // Every scaffolded file is author-owned, so edits must survive a re-run.
    const indexPath = join(dir, "tours/example-tour/index.tsx");
    const marker = "// EDITED BY AUTHOR — must survive re-run\n";
    const original = await readFile(indexPath, "utf-8");
    await writeFile(indexPath, marker + original, "utf-8");

    await runInstallCommand(["--no-install", "--dir", dir]);

    const after = await readFile(indexPath, "utf-8");
    expect(after.startsWith(marker)).toBe(true);
  });

  it("records a named dependency in package.json", async () => {
    await runInstallCommand(["--no-install", "--dir", dir, "@stigmer/react@^1.0.0"]);

    const pkg = JSON.parse(await readFile(join(dir, "package.json"), "utf-8"));
    expect(pkg.dependencies["@stigmer/react"]).toBe("^1.0.0");
  });

  it("rejects an invalid --package-manager", async () => {
    await runInstallCommand(["--no-install", "--dir", dir, "--package-manager", "bun"]);
    expect(process.exitCode).toBe(1);
  });
});
