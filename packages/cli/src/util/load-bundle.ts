import { readFile, access } from "node:fs/promises";
import { join, basename } from "node:path";
import { loadStepsFromTs } from "./load-ts.js";

/**
 * Lightweight bundle shape for CLI use. Mirrors the @scenar/core
 * ScenarioBundle interface but uses plain objects (the CLI does not
 * import @scenar/core at runtime to stay lightweight).
 */
export interface CliBundle {
  id: string;
  steps: Array<{ delayMs: number; narration?: string }>;
  narrationManifest?: {
    steps: Array<{ src: string; durationMs: number } | null>;
  };
}

/**
 * Load a scenario bundle from a directory.  Expects:
 *   <dir>/steps.ts       — required (step definitions)
 *   <dir>/narration/manifest.json — optional (narration manifest)
 *
 * The scenario id defaults to the directory base name.
 */
export async function loadBundle(dir: string): Promise<CliBundle> {
  const stepsPath = join(dir, "steps.ts");
  const manifestPath = join(dir, "narration", "manifest.json");

  const steps = await loadStepsFromTs(stepsPath);

  let narrationManifest: CliBundle["narrationManifest"];
  try {
    await access(manifestPath);
    const raw = await readFile(manifestPath, "utf-8");
    narrationManifest = JSON.parse(raw) as CliBundle["narrationManifest"];
  } catch {
    // No manifest — scenario plays without narration.
  }

  return {
    id: basename(dir),
    steps,
    narrationManifest,
  };
}
