import { readFile, access } from "node:fs/promises";
import { join, basename } from "node:path";
import {
  loadSoundtrackFromTs,
  loadStepsFromTs,
  loadTitleCardsFromTs,
  type AuthoredSoundtrack,
  type AuthoredTitleCards,
} from "./load-ts.js";

/**
 * Lightweight bundle shape for CLI use. Mirrors the @scenar/core
 * ScenarioBundle interface but uses plain objects (the CLI does not
 * import @scenar/core at runtime to stay lightweight).
 *
 * Carries the AUTHORED shape: steps as written, title cards as config.
 * Card-step synthesis (`applyTitleCards`) happens in the generated
 * render/pack entries — the true bundle-assembly seam — never here; the
 * CLI consumes this bundle for staging and inspection only.
 */
export interface CliBundle {
  id: string;
  steps: Array<{ delayMs: number; narration?: string }>;
  narrationManifest?: {
    steps: Array<{ src: string; durationMs: number } | null>;
  };
  soundtrack?: AuthoredSoundtrack;
  titleCards?: AuthoredTitleCards;
}

/**
 * Load a scenario bundle from a directory.  Expects:
 *   <dir>/steps.ts       — required (step definitions, optional
 *                          `soundtrack` named export)
 *   <dir>/narration/manifest.json — optional (narration manifest)
 *
 * The scenario id defaults to the directory base name.
 */
export async function loadBundle(dir: string): Promise<CliBundle> {
  const stepsPath = join(dir, "steps.ts");
  const manifestPath = join(dir, "narration", "manifest.json");

  const steps = await loadStepsFromTs(stepsPath);
  const soundtrack = await loadSoundtrackFromTs(stepsPath);
  const titleCards = await loadTitleCardsFromTs(stepsPath);

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
    soundtrack: soundtrack ?? undefined,
    titleCards: titleCards ?? undefined,
  };
}
