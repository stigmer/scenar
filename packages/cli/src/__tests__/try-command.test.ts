import { describe, it, expect } from "vitest";
import { createProgram } from "../index.js";

describe("scenar try", () => {
  it("registers the try command", () => {
    const program = createProgram();
    const cmd = program.commands.find((c) => c.name() === "try");
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain("no app required");
  });

  it("takes no positional arguments and exposes its options", () => {
    const program = createProgram();
    const cmd = program.commands.find((c) => c.name() === "try");
    expect(cmd!.registeredArguments).toHaveLength(0);
    const opts = cmd!.options.map((o) => o.long);
    expect(opts).toContain("--port");
    expect(opts).toContain("--host");
    expect(opts).toContain("--open");
  });
});
