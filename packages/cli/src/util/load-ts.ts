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

/** A scenario-authored canonical viewport, in CSS pixels. */
export interface AuthoredViewport {
  width: number;
  height: number;
}

function isViewportShape(value: unknown): value is AuthoredViewport {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record["width"] === "number" &&
    Number.isFinite(record["width"]) &&
    record["width"] > 0 &&
    typeof record["height"] === "number" &&
    Number.isFinite(record["height"]) &&
    record["height"] > 0
  );
}

function isStepsShape(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    typeof value[0] === "object" &&
    value[0] !== null &&
    "delayMs" in value[0]
  );
}

/**
 * Find the scenario's authored canonical viewport in a loaded module's
 * exports, or null when the module authors none (the common case — the
 * packer then falls back to CLI flags or its default).
 *
 * Two authored forms are honored, mirroring the two authoring surfaces:
 *
 * 1. A scenario-shaped export — an object carrying both a `viewport` and a
 *    delayMs-bearing `steps` array, i.e. what `createScenario()` returns.
 *    The viewport rides the scenario, so only a real scenario export
 *    qualifies; a stray `viewport` field on an unrelated object does not.
 * 2. An export *named* `viewport` with `{ width, height }` — the
 *    directory-form counterpart, for authors of a raw steps array.
 *
 * Precedence between the two follows specificity: a scenario-shaped export
 * wins, because its viewport is inseparable from the steps it sizes.
 */
export function findAuthoredViewport(exports: Record<string, unknown>): AuthoredViewport | null {
  for (const value of Object.values(exports)) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) continue;
    const record = value as Record<string, unknown>;
    if (isViewportShape(record["viewport"]) && isStepsShape(record["steps"])) {
      const viewport = record["viewport"] as AuthoredViewport;
      return { width: viewport.width, height: viewport.height };
    }
  }
  const named = exports["viewport"];
  if (isViewportShape(named)) {
    return { width: named.width, height: named.height };
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
