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
 * Dynamically import a TypeScript steps file and extract the
 * steps array by duck-typing (looks for the first exported array
 * whose elements have a `delayMs` property).
 *
 * Requires the caller's Node process to have a TypeScript loader
 * active (e.g. running via `tsx`). The CLI itself does not depend
 * on any TS compilation tool.
 */
export async function loadStepsFromTs(filePath: string): Promise<ImportedStep[]> {
  const mod = await import(pathToFileURL(filePath).href);
  const exports = mod.default ?? mod;

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

  throw new Error(`No steps array found in ${filePath}`);
}
