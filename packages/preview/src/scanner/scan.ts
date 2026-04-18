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

  const seenNames = new Set<string>();
  const deduped: DiscoveredComponent[] = [];
  for (const comp of allDiscovered) {
    if (seenNames.has(comp.name)) {
      const existing = deduped.find((c) => c.name === comp.name);
      if (existing && comp.exportType === "named" && existing.exportType === "default") {
        deduped.splice(deduped.indexOf(existing), 1);
        deduped.push(comp);
      }
      continue;
    }
    seenNames.add(comp.name);
    deduped.push(comp);
  }

  const detectedProviders = entryPoint
    ? detectProviders(project, path.resolve(projectRoot, entryPoint))
    : [];

  return {
    discovered: deduped,
    skipped: allSkipped,
    framework,
    entryPoint,
    detectedProviders,
  };
}

function findTsConfig(projectRoot: string): string | undefined {
  const candidates = ["tsconfig.json", "tsconfig.app.json"];
  for (const name of candidates) {
    const p = path.join(projectRoot, name);
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}
