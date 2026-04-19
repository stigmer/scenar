import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

/** File names checked in priority order for the renderStep export. */
const RENDER_FILE_CANDIDATES = ["render.tsx", "render.ts", "index.tsx", "index.ts"] as const;

/**
 * Locate the file that exports `renderStep` in the scenario directory.
 *
 * Checks `render.tsx` first (recommended — a lean file that only imports
 * view components), then falls back to `index.tsx`. Using a dedicated
 * `render.tsx` avoids pulling browser-only dependencies (preview
 * runtime, MSW, etc.) into the Remotion webpack bundle.
 *
 * Uses a lightweight source-text scan rather than a dynamic import.
 * The actual module resolution and type checking happens later when
 * Remotion's webpack bundler compiles the generated entry — which has
 * the full project dependency graph available. Importing the file
 * here at CLI time would pull in React, MUI, and other view-layer
 * dependencies that are not available in the Node CLI context.
 *
 * Returns the absolute path to the file containing renderStep.
 * Throws with a descriptive message if no suitable file is found.
 */
export async function detectRenderExport(scenarioDir: string): Promise<string> {
  for (const filename of RENDER_FILE_CANDIDATES) {
    const candidate = join(scenarioDir, filename);

    try {
      await access(candidate);
    } catch {
      continue;
    }

    const source = await readFile(candidate, "utf-8");
    if (hasRenderStepExport(source)) {
      return candidate;
    }
  }

  throw new Error(
    `No renderStep export found in ${scenarioDir}.\n\n` +
    "The render command expects the scenario directory to contain a\n" +
    "render.tsx (or index.tsx) that exports a renderStep function:\n\n" +
    "  // render.tsx (recommended — keeps video export deps minimal)\n" +
    "  export function renderStep(data: YourStepType, stepIndex: number): ReactNode {\n" +
    "    // map step data to view elements\n" +
    "  }\n\n" +
    "Using a dedicated render.tsx avoids pulling browser-only preview\n" +
    "dependencies into the Remotion webpack bundle.\n\n" +
    "Alternatively, use --entry to provide a custom Remotion entry point.",
  );
}

/**
 * Heuristic check for `renderStep` being exported from the source.
 *
 * Matches patterns like:
 *   export function renderStep(
 *   export const renderStep =
 *   export { renderStep }
 *   export { renderStep as renderStep }
 *   export { foo as renderStep }
 */
function hasRenderStepExport(source: string): boolean {
  return /export\s+(function|const|let|var)\s+renderStep[\s(<]/.test(source) ||
    /export\s*\{[^}]*\brenderStep\b[^}]*\}/.test(source);
}
