import { resolve, isAbsolute, join } from "node:path";

/**
 * The project root the server reads relative paths against. Cursor launches the
 * MCP server with its working directory set to the workspace, but an explicit
 * SCENAR_PROJECT_ROOT always wins (useful for monorepos or non-cwd launches).
 */
export function projectRoot(): string {
  return resolve(process.env.SCENAR_PROJECT_ROOT ?? process.cwd());
}

/** Resolve a possibly-relative path against the project root. */
export function resolveInProject(path: string): string {
  return isAbsolute(path) ? path : join(projectRoot(), path);
}
