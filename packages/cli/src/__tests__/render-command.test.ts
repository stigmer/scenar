import { describe, it, expect, vi, beforeEach } from "vitest";
import { createProgram } from "../index.js";

describe("scenar render", () => {
  let stderrOutput: string;

  beforeEach(() => {
    stderrOutput = "";
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      stderrOutput += String(chunk);
      return true;
    });
    process.exitCode = undefined;
  });

  it("registers the render command with correct description", () => {
    const program = createProgram();
    const renderCmd = program.commands.find((c) => c.name() === "render");
    expect(renderCmd).toBeDefined();
    expect(renderCmd!.description()).toContain("MP4 video");
    expect(renderCmd!.description()).toContain("Remotion");
  });

  it("accepts a directory argument", () => {
    const program = createProgram();
    const renderCmd = program.commands.find((c) => c.name() === "render");
    expect(renderCmd).toBeDefined();
    expect(renderCmd!.registeredArguments).toHaveLength(1);
    expect(renderCmd!.registeredArguments[0]!.name()).toBe("dir");
  });

  it("exposes all required options", () => {
    const program = createProgram();
    const renderCmd = program.commands.find((c) => c.name() === "render");
    expect(renderCmd).toBeDefined();

    const optionNames = renderCmd!.options.map((o) => o.long);
    expect(optionNames).toContain("--out");
    expect(optionNames).toContain("--fps");
    expect(optionNames).toContain("--width");
    expect(optionNames).toContain("--height");
    expect(optionNames).toContain("--entry");
    expect(optionNames).toContain("--composition-id");
    expect(optionNames).toContain("--webpack-override");
  });

  it("defaults fps to 30, width to 1920, height to 1080", () => {
    const program = createProgram();
    const renderCmd = program.commands.find((c) => c.name() === "render");
    expect(renderCmd).toBeDefined();

    const getDefault = (long: string) =>
      renderCmd!.options.find((o) => o.long === long)?.defaultValue;

    expect(getDefault("--fps")).toBe("30");
    expect(getDefault("--width")).toBe("1920");
    expect(getDefault("--height")).toBe("1080");
  });

  it("sets exit code 1 when given a nonexistent path", async () => {
    const program = createProgram();
    program.exitOverride();

    try {
      await program.parseAsync([
        "node",
        "scenar",
        "render",
        "/tmp/__nonexistent_scenar_test_path__",
      ]);
    } catch {
      // Commander may throw on exitOverride.
    }

    expect(process.exitCode).toBe(1);
    expect(stderrOutput).toContain("Error");
  });
});
