import { readdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * Scan a directory for scenario subdirectories. A subdirectory
 * qualifies if it contains a `steps.ts` file.
 *
 * Returns sorted scenario entries with the directory name (used as
 * the scenario ID) and the absolute path to `steps.ts`.
 */
export async function discoverScenarios(
  dir: string,
): Promise<Array<{ id: string; stepsPath: string }>> {
  const entries = await readdir(dir, { withFileTypes: true });
  const scenarios: Array<{ id: string; stepsPath: string }> = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const stepsPath = join(dir, entry.name, "steps.ts");
    try {
      const { access } = await import("node:fs/promises");
      await access(stepsPath);
      scenarios.push({ id: entry.name, stepsPath });
    } catch {
      // No steps.ts — skip.
    }
  }

  return scenarios.sort((a, b) => a.id.localeCompare(b.id));
}
