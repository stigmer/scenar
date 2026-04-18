import type { ScanResult } from "../../scanner/types.js";

/**
 * Render `scenar.config.ts` — the scan configuration file.
 * Created once by init, never overwritten.
 *
 * @param sourceRoot Absolute path to the scanned project.
 *   When it differs from the output directory's parent, a `source`
 *   field is emitted so `scenar preview sync` knows where to scan.
 */
export function renderConfig(scanResult: ScanResult, sourceRoot: string): string {
  const lines: string[] = [];

  lines.push(`import { defineConfig } from "@scenar/preview";`);
  lines.push(``);
  lines.push(`export default defineConfig({`);
  lines.push(`  source: "${sourceRoot}",`);
  lines.push(`  sourceRoots: ["src"],`);
  lines.push(`  exclude: [`);
  lines.push(`    "**/*.test.*",`);
  lines.push(`    "**/*.spec.*",`);
  lines.push(`    "**/*.stories.*",`);
  lines.push(`    "**/node_modules/**",`);
  lines.push(`    "**/dist/**",`);
  lines.push(`    "**/build/**",`);
  lines.push(`    "**/.next/**",`);
  lines.push(`    "**/__tests__/**",`);
  lines.push(`    "**/__mocks__/**",`);
  lines.push(`  ],`);
  lines.push(`  framework: "${scanResult.framework}",`);

  if (scanResult.entryPoint) {
    lines.push(`  entryPoint: "${scanResult.entryPoint}",`);
  }

  lines.push(`});`);
  lines.push(``);

  return lines.join("\n");
}
