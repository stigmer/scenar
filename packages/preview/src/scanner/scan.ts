import { Project } from "ts-morph";
import * as path from "path";
import * as fs from "fs";
import { detectComponents } from "./detect-components.js";
import { detectFramework, detectEntryPoint } from "./detect-framework.js";
import { detectProviders } from "./detect-providers.js";
import type { ScanResult, DiscoveredComponent, SkippedComponent } from "./types.js";
import type { PreviewConfig } from "../config.js";

/**
 * Scan a React project and discover components suitable for the
 * Scenar preview view registry.
 *
 * @param projectRoot Absolute path to the project root.
 * @param config      Optional preview config; auto-detects if omitted.
 */
export function scanProject(
  projectRoot: string,
  config?: Partial<PreviewConfig>,
): ScanResult {
  const framework = config?.framework ?? detectFramework(projectRoot);
  const entryPoint = config?.entryPoint ?? detectEntryPoint(projectRoot, framework);
  const sourceRoots = config?.sourceRoots ?? ["src"];
  const exclude = config?.exclude ?? [
    "**/*.test.*",
    "**/*.spec.*",
    "**/*.stories.*",
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/.next/**",
    "**/__tests__/**",
    "**/__mocks__/**",
  ];

  const tsconfigPath = findTsConfig(projectRoot);
  const project = new Project({
    tsConfigFilePath: tsconfigPath,
    skipAddingFilesFromTsConfig: true,
  });

  const globs = sourceRoots.map((root) =>
    path.join(projectRoot, root, "**/*.{ts,tsx,js,jsx}"),
  );
  project.addSourceFilesAtPaths(globs);

  const excludePatterns = exclude.map((pattern) =>
    new RegExp(
      pattern
        .replace(/\*\*/g, ".*")
        .replace(/\*/g, "[^/]*")
        .replace(/\./g, "\\."),
    ),
  );

  const allDiscovered: DiscoveredComponent[] = [];
  const allSkipped: SkippedComponent[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();

    const isExcluded = excludePatterns.some((re) => re.test(filePath));
    if (isExcluded) continue;

    const { discovered, skipped } = detectComponents(sourceFile, projectRoot);
    allDiscovered.push(...discovered);
    allSkipped.push(...skipped);
  }

  // UI primitives (Button, Tooltip, …) are leaf building blocks, not scenario
  // views: registering them floods the registry with huge prop surfaces. Keep
  // them out of the generated registry but surface them in the report so a user
  // can still opt one in via views.custom.tsx.
  const primitives = allDiscovered.filter((c) => c.category === "primitive");
  const registrable = allDiscovered.filter((c) => c.category !== "primitive");

  // Collapse same-file duplicates (e.g. a component re-exported as both default
  // and named), preferring the named export so imports stay explicit.
  const collapsed = new Map<string, DiscoveredComponent>();
  for (const comp of registrable) {
    const key = `${comp.filePath}::${comp.name}`;
    const existing = collapsed.get(key);
    if (!existing) {
      collapsed.set(key, comp);
      continue;
    }
    if (existing.exportType === "default" && comp.exportType === "named") {
      collapsed.set(key, comp);
    }
  }

  // Assign a unique registry key to every survivor. Cross-file name collisions
  // (every Next.js `page.tsx` default-exports `Page`, etc.) are disambiguated
  // with a path-derived qualifier instead of silently dropping components.
  const takenKeys = new Set<string>();
  const deduped: DiscoveredComponent[] = [];
  for (const comp of collapsed.values()) {
    const key = uniqueKey(comp.name, comp.filePath, takenKeys);
    takenKeys.add(key);
    deduped.push(key === comp.name ? comp : { ...comp, name: key });
  }

  // Skipped: fold in the excluded primitives, dedupe by (file, export, reason),
  // and drop anything that was actually discovered under the same file/export.
  const discoveredExports = new Set(
    deduped.map((c) => `${c.filePath}::${c.exportName}`),
  );
  const primitiveSkips: SkippedComponent[] = primitives.map((c) => ({
    name: c.name,
    filePath: c.filePath,
    reason: "ui-primitive",
  }));
  const seenSkips = new Set<string>();
  const skipped: SkippedComponent[] = [];
  for (const skip of [...allSkipped, ...primitiveSkips]) {
    const key = `${skip.filePath}::${skip.name}::${skip.reason}`;
    if (seenSkips.has(key)) continue;
    seenSkips.add(key);
    if (discoveredExports.has(`${skip.filePath}::${skip.name}`)) continue;
    skipped.push(skip);
  }

  const detectedProviders = entryPoint
    ? detectProviders(project, path.resolve(projectRoot, entryPoint))
    : [];

  return {
    discovered: deduped,
    skipped,
    framework,
    entryPoint,
    detectedProviders,
  };
}

/**
 * Produce a registry key that is unique within the scan. Returns `name`
 * unchanged when free; otherwise prefixes meaningful route/directory segments
 * (nearest-to-file first, growing outward, skipping generic and dynamic-route
 * segments) so a colliding `Page` becomes e.g. `LibraryMcpServersPage`. Falls
 * back to a numeric suffix only if no segments disambiguate.
 */
function uniqueKey(
  name: string,
  filePath: string,
  taken: ReadonlySet<string>,
): string {
  if (!taken.has(name)) return name;

  const segments = routeSegments(filePath);
  for (let take = 1; take <= segments.length; take++) {
    const chosen = segments.slice(segments.length - take);
    const candidate = chosen.map(toPascalCase).join("") + name;
    if (!taken.has(candidate)) return candidate;
  }

  let suffix = 2;
  while (taken.has(`${name}${suffix}`)) suffix++;
  return `${name}${suffix}`;
}

/**
 * Meaningful path segments for disambiguation: everything below the source/route
 * root (`src`, `app`, or `pages`), minus dynamic route segments (`[id]`) and
 * generic structural folders, ordered root→file and with the filename dropped.
 */
function routeSegments(filePath: string): string[] {
  const parts = filePath.split("/").slice(0, -1).filter(Boolean);
  let start = 0;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (ROUTE_ROOT_SEGMENTS.has(parts[i]!.toLowerCase())) {
      start = i + 1;
      break;
    }
  }
  return parts
    .slice(start)
    .filter((seg) => !seg.startsWith("[") && !GENERIC_DIR_SEGMENTS.has(seg.toLowerCase()));
}

const ROUTE_ROOT_SEGMENTS = new Set(["src", "app", "pages"]);

const GENERIC_DIR_SEGMENTS = new Set([
  "components",
  "domain",
  "_shared",
  "ui",
  "lib",
  "features",
]);

function toPascalCase(s: string): string {
  return s
    .replace(/[-_.]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, (_, c: string) => c.toUpperCase());
}

function findTsConfig(projectRoot: string): string | undefined {
  const candidates = ["tsconfig.json", "tsconfig.app.json"];
  for (const name of candidates) {
    const p = path.join(projectRoot, name);
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}
