import { describe, it, expect, vi, beforeEach } from "vitest";
import { createProgram } from "../index.js";

describe("scenar deploy", () => {
  let stderrOutput: string;

  beforeEach(() => {
    stderrOutput = "";
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      stderrOutput += String(chunk);
      return true;
    });
    process.exitCode = undefined;
  });

  it("registers the deploy command", () => {
    const program = createProgram();
    const cmd = program.commands.find((c) => c.name() === "deploy");
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain("embed URL");
  });

  it("accepts a bundle directory argument and exposes its options", () => {
    const program = createProgram();
    const cmd = program.commands.find((c) => c.name() === "deploy");
    expect(cmd!.registeredArguments[0]!.name()).toBe("bundleDir");
    const opts = cmd!.options.map((o) => o.long);
    expect(opts).toContain("--backend");
    expect(opts).toContain("--org");
    expect(opts).toContain("--slug");
    expect(opts).toContain("--name");
  });

  it("fails clearly when the bundle directory does not exist", async () => {
    const program = createProgram();
    program.exitOverride();
    try {
      await program.parseAsync(["node", "scenar", "deploy", "/tmp/__no_bundle__", "--org", "acme"]);
    } catch {
      // exitOverride
    }
    expect(process.exitCode).toBe(1);
    expect(stderrOutput).toContain("Error");
  });
});
