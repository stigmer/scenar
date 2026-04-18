import * as fs from "fs";
import * as path from "path";
import type { ScanResult } from "../scanner/types.js";
import type { GenerateOptions, GenerateResult } from "./types.js";
import { renderViewsGenerated } from "./templates/views-generated.js";
import { renderViewsCustom } from "./templates/views-custom.js";
import { renderViewsBarrel } from "./templates/views-barrel.js";
import { renderProviders } from "./templates/providers.js";
import { renderPreview } from "./templates/preview.js";
import { renderReport } from "./templates/report.js";
import { renderConfig } from "./templates/config.js";

/**
 * Generate the `.scenar/` directory from scan results.
 *
 * Follows split-ownership rules:
 * - Scanner-owned files are always (re)written.
 * - User-owned files are only created if they don't exist (init)
 *   or if explicitly requested (--reset-providers).
 */
export function generate(
  scanResult: ScanResult,
  options: GenerateOptions,
): GenerateResult {
  const outputDir = path.resolve(
    options.projectRoot,
    options.outputDir ?? ".scenar",
  );
  const isInit = options.isInit ?? true;
  const written: string[] = [];
  const preserved: string[] = [];

  fs.mkdirSync(outputDir, { recursive: true });

  // --- Scanner-owned files (always written) ---

  writeFile(outputDir, "views.generated.ts", renderViewsGenerated(scanResult, outputDir));
  written.push("views.generated.ts");

  writeFile(outputDir, "views.ts", renderViewsBarrel());
  written.push("views.ts");

  writeFile(outputDir, "preview.tsx", renderPreview());
  written.push("preview.tsx");

  writeFile(outputDir, "report.md", renderReport(scanResult));
  written.push("report.md");

  // --- User-owned files (only on init or if missing) ---

  const customPath = path.join(outputDir, "views.custom.tsx");
  if (!fs.existsSync(customPath)) {
    writeFile(outputDir, "views.custom.tsx", renderViewsCustom());
    written.push("views.custom.tsx");
  } else {
    preserved.push("views.custom.tsx");
  }

  const providersPath = path.join(outputDir, "providers.tsx");
  if (!fs.existsSync(providersPath) || (isInit && options.resetProviders)) {
    writeFile(outputDir, "providers.tsx", renderProviders(scanResult));
    written.push("providers.tsx");
  } else {
    preserved.push("providers.tsx");
  }

  const configPath = path.join(outputDir, "scenar.config.ts");
  if (!fs.existsSync(configPath) && isInit) {
    writeFile(outputDir, "scenar.config.ts", renderConfig(scanResult));
    written.push("scenar.config.ts");
  } else if (fs.existsSync(configPath)) {
    preserved.push("scenar.config.ts");
  }

  return { written, preserved };
}

function writeFile(dir: string, name: string, content: string): void {
  fs.writeFileSync(path.join(dir, name), content, "utf-8");
}
