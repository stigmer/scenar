import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runValidate } from "../commands/validate.js";

vi.mock("../util/load-yaml.js", () => ({
  loadScenarioYaml: vi.fn(),
}));

import { loadScenarioYaml } from "../util/load-yaml.js";

const mockLoad = vi.mocked(loadScenarioYaml);

describe("scenar validate", () => {
  let stdoutData: string;
  let stderrData: string;
  let originalExitCode: number | undefined;

  beforeEach(() => {
    stdoutData = "";
    stderrData = "";
    originalExitCode = process.exitCode;
    process.exitCode = undefined;

    vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
      stdoutData += String(chunk);
      return true;
    });
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: string | Uint8Array) => {
      stderrData += String(chunk);
      return true;
    });
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
    vi.restoreAllMocks();
  });

  it("prints success for a valid scenario", async () => {
    mockLoad.mockResolvedValue({
      steps: [{ view: "intro", delayMs: 0 }],
    });

    await runValidate("demo.yaml", {});

    expect(stdoutData).toContain("valid");
    expect(process.exitCode).toBeUndefined();
  });

  it("prints errors and sets exit code 1 for invalid scenario", async () => {
    mockLoad.mockResolvedValue({ steps: [] });

    await runValidate("bad.yaml", {});

    expect(stderrData).toContain("error");
    expect(process.exitCode).toBe(1);
  });

  it("outputs JSON when --json flag is set", async () => {
    mockLoad.mockResolvedValue({
      steps: [{ view: "intro", delayMs: 0 }],
    });

    await runValidate("demo.yaml", { json: true });

    const output = JSON.parse(stdoutData);
    expect(output.valid).toBe(true);
    expect(output.errors).toEqual([]);
  });

  it("outputs JSON with errors and sets exit code 1", async () => {
    mockLoad.mockResolvedValue({ steps: [] });

    await runValidate("bad.yaml", { json: true });

    const output = JSON.parse(stdoutData);
    expect(output.valid).toBe(false);
    expect(output.errors.length).toBeGreaterThan(0);
    expect(process.exitCode).toBe(1);
  });
});
