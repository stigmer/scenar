import { access } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";

const PROVIDERS_FILENAME = "providers.tsx";
const SCENAR_DIR = ".scenar";

/**
 * Walk up from `startDir` looking for `.scenar/providers.tsx`.
 *
 * Returns the absolute path if found, or `null` if the filesystem
 * root is reached without finding it. Stops at the filesystem root
 * to avoid scanning outside the project.
 */
export async function resolveProvidersPath(
  startDir: string,
): Promise<string | null> {
  let current = resolve(startDir);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = join(current, SCENAR_DIR, PROVIDERS_FILENAME);
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Not found at this level — move up.
    }

    const parent = dirname(current);
    if (parent === current) {
      // Reached filesystem root.
      return null;
    }
    current = parent;
  }
}
