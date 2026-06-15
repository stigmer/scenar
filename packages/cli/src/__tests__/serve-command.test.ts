import { describe, it, expect, vi, beforeEach } from "vitest";
import { createProgram } from "../index.js";

describe("scenar serve", () => {
  let stderrOutput: string;

  beforeEach(() => {
    stderrOutput = "";
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      stderrOutput += String(chunk);
      return true;
    });
    process.exitCode = undefined;
  });

  it("registers the serve command", () => {
    const program = createProgram();
    const cmd = program.commands.find((c) => c.name() === "serve");
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain("embed URL");
  });

  it("accepts a bundle directory argument and exposes its options", () => {
    const program = createProgram();
    const cmd = program.commands.find((c) => c.name() === "serve");
    expect(cmd!.registeredArguments[0]!.name()).toBe("bundleDir");
    const opts = cmd!.options.map((o) => o.long);
    expect(opts).toContain("--port");
    expect(opts).toContain("--host");
    expect(opts).toContain("--open");
  });

  it("fails clearly when the bundle directory does not exist", async () => {
    const program = createProgram();
    program.exitOverride();
    try {
      await program.parseAsync(["node", "scenar", "serve", "/tmp/__no_bundle__"]);
    } catch {
      // exitOverride throws on a non-zero exit; the assertion is on exitCode.
    }
    expect(process.exitCode).toBe(1);
    expect(stderrOutput).toContain("Error");
  });
});
