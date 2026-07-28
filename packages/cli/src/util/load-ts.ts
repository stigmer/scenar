import { pathToFileURL } from "node:url";

/**
 * Minimal shape extracted from each step object. The loader
 * duck-types the exported array — any array of objects with
 * `delayMs` qualifies as a steps array.
 */
export interface ImportedStep {
  delayMs: number;
  narration?: string;
}

/**
 * Find the steps array in a loaded module's exports by duck-typing: the
 * first exported array whose first element has a `delayMs` property.
 * Returns null when the module exports no such array.
 *
 * This is THE steps-discovery rule, shared by every Node-side loader and
 * mirrored verbatim by the browser-side `_findSteps` in the generated
 * pack entry (see generate-embed-entry.ts) — the mirrors must agree, or
 * pack-time tooling would see different steps than the packed bundle.
 */
export function findStepsArray(exports: Record<string, unknown>): ImportedStep[] | null {
  for (const value of Object.values(exports)) {
    if (
      Array.isArray(value) &&
      value.length > 0 &&
      typeof value[0] === "object" &&
      value[0] !== null &&
      "delayMs" in value[0]
    ) {
      return value as ImportedStep[];
    }
  }
  return null;
}

/**
 * Dynamically import a TypeScript steps file and extract the
 * steps array by duck-typing ({@link findStepsArray}).
 *
 * Requires the caller's Node process to have a TypeScript loader
 * active (e.g. running via `tsx`). The CLI itself does not depend
 * on any TS compilation tool.
 */
export async function loadStepsFromTs(filePath: string): Promise<ImportedStep[]> {
  const mod = await import(pathToFileURL(filePath).href);
  const steps = findStepsArray(mod.default ?? mod);
  if (steps === null) {
    throw new Error(`No steps array found in ${filePath}`);
  }
  return steps;
}
