import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";

/**
 * Recursively converts all object keys from snake_case to camelCase.
 * Arrays are traversed element-by-element; primitives pass through unchanged.
 */
export function snakeToCamelKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(snakeToCamelKeys);
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[snakeToCamel(key)] = snakeToCamelKeys(val);
    }
    return result;
  }
  return value;
}

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase());
}

/**
 * Reads a scenario YAML file from disk, parses it, and converts
 * snake_case field names to the camelCase convention used by the
 * SDK's `ProtoScenario` type.
 *
 * @throws {Error} on file-not-found or YAML parse failure.
 */
export async function loadScenarioYaml(filePath: string): Promise<unknown> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error(`File not found: ${filePath}`);
    }
    throw new Error(`Failed to read file: ${filePath} (${code ?? "unknown error"})`);
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid YAML in ${filePath}: ${message}`);
  }

  if (parsed === null || parsed === undefined || typeof parsed !== "object") {
    throw new Error(`Expected a YAML mapping (object) in ${filePath}, got ${parsed === null ? "null" : typeof parsed}.`);
  }

  return snakeToCamelKeys(parsed);
}
