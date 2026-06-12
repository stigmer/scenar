import { describe, it, expect, vi, beforeEach } from "vitest";
import { createProgram } from "../index.js";

describe("scenar pack", () => {
  let stderrOutput: string;

  beforeEach(() => {
    stderrOutput = "";
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      stderrOutput += String(chunk);
      return true;
    });
    process.exitCode = undefined;
  });

  it("registers the pack command", () => {
    const program = createProgram();
    const cmd = program.commands.find((c) => c.name() === "pack");
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain("hosted embed");
  });

  it("accepts a directory argument", () => {
    const program = createProgram();
    const cmd = program.commands.find((c) => c.name() === "pack");
    expect(cmd!.registeredArguments).toHaveLength(1);
    expect(cmd!.registeredArguments[0]!.name()).toBe("dir");
  });

  it("exposes its options", () => {
    const program = createProgram();
    const cmd = program.commands.find((c) => c.name() === "pack");
    const opts = cmd!.options.map((o) => o.long);
    expect(opts).toContain("--out");
    expect(opts).toContain("--width");
    expect(opts).toContain("--shell-height");
    expect(opts).toContain("--keep-temp");
  });

  it("sets exit code 1 when given a nonexistent path", async () => {
    const program = createProgram();
    program.exitOverride();
    try {
      await program.parseAsync(["node", "scenar", "pack", "/tmp/__no_such_scenar_dir__"]);
    } catch {
      // commander throws under exitOverride
    }
    expect(process.exitCode).toBe(1);
    expect(stderrOutput).toContain("Error");
  });
});
