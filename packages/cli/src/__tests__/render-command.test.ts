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
    expect(optionNames).toContain("--captions");
    expect(optionNames).toContain("--viewport");
    expect(optionNames).toContain("--stage");
  });

  it("describes --viewport as an override, not an enabler (scenar#29)", () => {
    const program = createProgram();
    const renderCmd = program.commands.find((c) => c.name() === "render");
    const viewport = renderCmd!.options.find((o) => o.long === "--viewport");
    expect(viewport).toBeDefined();
    // The presentation stack always mounts; the flag only overrides the
    // authored/default canonical size.
    expect(viewport!.description).toContain("override");
    expect(viewport!.description).toContain("authored");
  });

  it("keeps --captions a boolean flag that defaults off", () => {
    const program = createProgram();
    const renderCmd = program.commands.find((c) => c.name() === "render");
    const captions = renderCmd!.options.find((o) => o.long === "--captions");
    expect(captions).toBeDefined();
    // No <value> placeholder: presence of the flag is the opt-in.
    expect(captions!.flags).toBe("--captions");
    expect(captions!.defaultValue).toBeUndefined();
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

  it("no longer rejects --stage without --viewport (scenar#29)", async () => {
    const program = createProgram();
    program.exitOverride();

    try {
      await program.parseAsync([
        "node",
        "scenar",
        "render",
        "/tmp/__nonexistent_scenar_test_path__",
        "--stage",
      ]);
    } catch {
      // Commander may throw on exitOverride.
    }

    // The viewport now always resolves (explicit > authored > default),
    // so the old pairing error is gone; the failure is the missing dir.
    expect(stderrOutput).not.toContain("--stage requires --viewport");
    expect(stderrOutput).toContain("does not exist");
  });
});
