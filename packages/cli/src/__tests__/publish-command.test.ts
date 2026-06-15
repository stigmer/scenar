import { describe, it, expect, vi, beforeEach } from "vitest";
import { createProgram } from "../index.js";

describe("scenar publish", () => {
  let stderrOutput: string;

  beforeEach(() => {
    stderrOutput = "";
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      stderrOutput += String(chunk);
      return true;
    });
    process.exitCode = undefined;
  });

  it("registers the publish command", () => {
    const program = createProgram();
    const cmd = program.commands.find((c) => c.name() === "publish");
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain("GitHub Pages");
  });

  it("accepts a bundle directory argument and exposes its options", () => {
    const program = createProgram();
    const cmd = program.commands.find((c) => c.name() === "publish");
    expect(cmd!.registeredArguments[0]!.name()).toBe("bundleDir");
    const opts = cmd!.options.map((o) => o.long);
    expect(opts).toContain("--repo");
    expect(opts).toContain("--path");
    expect(opts).toContain("--org");
    expect(opts).toContain("--private");
    expect(opts).toContain("--message");
  });

  it("fails clearly when the bundle directory does not exist (no GitHub calls)", async () => {
    const program = createProgram();
    program.exitOverride();
    try {
      await program.parseAsync(["node", "scenar", "publish", "/tmp/__no_bundle__"]);
    } catch {
      // exitOverride throws on non-zero exit; assert on exitCode below.
    }
    expect(process.exitCode).toBe(1);
    expect(stderrOutput).toContain("Error");
  });
});
