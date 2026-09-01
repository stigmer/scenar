import { readFile, access } from "node:fs/promises";
import { join, basename } from "node:path";
import {
  loadSoundtrackFromTs,
  loadStepsFromTs,
  loadTitleCardsFromTs,
  loadViewportFromTs,
  type AuthoredSoundtrack,
  type AuthoredTitleCards,
  type AuthoredViewport,
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
  presenterManifest?: {
    steps: Array<{
      src: string;
      durationMs: number;
      /** Probed clip pixel dimensions (scenar#30); absent on old manifests. */
      width?: number;
      height?: number;
    } | null>;
  };
  soundtrack?: AuthoredSoundtrack;
  titleCards?: AuthoredTitleCards;
  /**
   * The scenario's authored canonical viewport, when steps.ts declares one
   * (`createScenario({ viewport })` or a named `viewport` export). Render
   * resolves its presentation geometry from this the same way pack does.
   */
  viewport?: AuthoredViewport;
}

/**
 * Load a scenario bundle from a directory.  Expects:
 *   <dir>/steps.ts       — required (step definitions, optional
 *                          `soundtrack` named export)
 *   <dir>/narration/manifest.json — optional (narration manifest)
 *   <dir>/presenter/manifest.json — optional (presenter manifest)
 *
 * The scenario id defaults to the directory base name.
 */
export async function loadBundle(dir: string): Promise<CliBundle> {
  const stepsPath = join(dir, "steps.ts");

  const steps = await loadStepsFromTs(stepsPath);
  const soundtrack = await loadSoundtrackFromTs(stepsPath);
  const titleCards = await loadTitleCardsFromTs(stepsPath);
  const viewport = await loadViewportFromTs(stepsPath);

  return {
    id: basename(dir),
    steps,
    narrationManifest: await readPositionalManifest(join(dir, "narration", "manifest.json")),
    presenterManifest: await readPositionalManifest(join(dir, "presenter", "manifest.json")),
    soundtrack: soundtrack ?? undefined,
    titleCards: titleCards ?? undefined,
    viewport: viewport ?? undefined,
  };
}

/** Read a positional clip manifest, or undefined when none exists. */
async function readPositionalManifest(
  manifestPath: string,
): Promise<CliBundle["narrationManifest"]> {
  try {
    await access(manifestPath);
    const raw = await readFile(manifestPath, "utf-8");
    return JSON.parse(raw) as CliBundle["narrationManifest"];
  } catch {
    return undefined; // No manifest — the scenario plays without this track.
  }
}
