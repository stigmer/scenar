import * as fs from "fs";
import * as path from "path";
import type { FrameworkType } from "../config.js";

/**
 * Auto-detect the React framework used in a project by inspecting
 * package.json dependencies and well-known config files.
 */
export function detectFramework(projectRoot: string): FrameworkType {
  const pkgPath = path.join(projectRoot, "package.json");
  if (!fs.existsSync(pkgPath)) return "unknown";

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as Record<string, unknown>;
  } catch {
    return "unknown";
  }

  const allDeps = {
    ...(pkg["dependencies"] as Record<string, string> | undefined),
    ...(pkg["devDependencies"] as Record<string, string> | undefined),
  };

  if ("next" in allDeps) return "nextjs";
  if ("@remix-run/react" in allDeps) return "remix";

  if (fs.existsSync(path.join(projectRoot, "vite.config.ts")) ||
      fs.existsSync(path.join(projectRoot, "vite.config.js")) ||
      fs.existsSync(path.join(projectRoot, "vite.config.mts"))) {
    return "vite";
  }

  if ("react-scripts" in allDeps) return "cra";

  return "unknown";
}

const ENTRY_CANDIDATES: Record<FrameworkType, readonly string[]> = {
  nextjs: [
    "src/app/layout.tsx",
    "src/app/layout.jsx",
    "app/layout.tsx",
    "app/layout.jsx",
    "src/pages/_app.tsx",
    "src/pages/_app.jsx",
    "pages/_app.tsx",
    "pages/_app.jsx",
  ],
  vite: [
    "src/main.tsx",
    "src/main.jsx",
    "src/App.tsx",
    "src/App.jsx",
  ],
  cra: [
    "src/index.tsx",
    "src/index.jsx",
    "src/App.tsx",
    "src/App.jsx",
  ],
  remix: [
    "app/root.tsx",
    "app/root.jsx",
  ],
  unknown: [
    "src/main.tsx",
    "src/main.jsx",
    "src/index.tsx",
    "src/index.jsx",
    "src/App.tsx",
    "src/App.jsx",
  ],
};

/**
 * Find the app entry point for a given framework.
 * Returns a relative path from the project root, or undefined if not found.
 */
export function detectEntryPoint(
  projectRoot: string,
  framework: FrameworkType,
): string | undefined {
  const candidates = ENTRY_CANDIDATES[framework] ?? ENTRY_CANDIDATES.unknown;
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(projectRoot, candidate))) {
      return candidate;
    }
  }
  return undefined;
}
