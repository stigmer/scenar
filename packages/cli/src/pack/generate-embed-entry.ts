import { posix } from "node:path";

/**
 * Inputs required to generate the web entry for a packed scenario.
 *
 * All paths are absolute filesystem paths; the generator converts them to
 * posix-style forward-slash specifiers suitable for Vite/Rollup imports.
 */
export interface EmbedEntryInput {
  /** Absolute path to the scenario directory (contains steps.ts). */
  scenarioDir: string;
  /** Absolute path to the file that exports renderStep. */
  renderFilePath: string;
  /** Scenario ID (directory basename) — used as the bundle id. */
  scenarioId: string;
  /** Whether the scenario has a narration manifest (+ audio). */
  hasNarration: boolean;
  /** Absolute path to .scenar/providers.tsx, or null if none. */
  providersPath: string | null;
  /** Canonical viewport width in px (children render at this width). */
  canonicalWidth: number;
  /** Shell height in px, exposed as --scenar-shell-height. */
  shellHeight: number;
}

/**
 * Produce the TypeScript source for the browser entry that mounts a scenario as
 * a live, hosted embed.
 *
 * This is the web sibling of the Remotion entry generator: instead of
 * registering a Remotion composition, it mounts {@link ScenarioPlayer} into
 * `#root` with the same `bundle` + `renderStep` contract. It imports the
 * @scenar/react theme + styles so the bundle is self-contained, and scopes the
 * tree with `SCENAR_CLASS` + `DemoViewport` exactly as the authoring surfaces do.
 *
 * Pure function, no side effects — the caller writes the result to disk.
 */
export function generateEmbedEntry(input: EmbedEntryInput): string {
  const scenarioPath = toPosix(input.scenarioDir);
  const stepsImport = `${scenarioPath}/steps`;
  const renderImport = toPosix(input.renderFilePath).replace(/\.[^.]+$/, "");

  const lines: string[] = [];

  // --- Imports ---
  lines.push(`import { createRoot } from "react-dom/client";`);
  lines.push(`import { ScenarioPlayer, DemoViewport, SCENAR_CLASS } from "@scenar/react";`);
  lines.push(`import "@scenar/react/theme.css";`);
  lines.push(`import "@scenar/react/styles.css";`);
  lines.push(`import { renderStep } from ${JSON.stringify(renderImport)};`);
  lines.push(`import * as _stepsModule from ${JSON.stringify(stepsImport)};`);

  if (input.hasNarration) {
    const manifestPath = `${scenarioPath}/narration/manifest.json`;
    lines.push(`import _manifest from ${JSON.stringify(manifestPath)};`);
  } else {
    lines.push(`const _manifest = undefined;`);
  }

  if (input.providersPath) {
    const providersImport = toPosix(input.providersPath).replace(/\.[^.]+$/, "");
    lines.push(
      `import { PreviewProviders as _Providers } from ${JSON.stringify(providersImport)};`,
    );
  }

  // --- Steps resolution (duck-type the first array of objects with delayMs) ---
  lines.push(``);
  lines.push(`function _findSteps(mod: Record<string, unknown>): unknown[] {`);
  lines.push(`  for (const val of Object.values(mod)) {`);
  lines.push(`    if (`);
  lines.push(`      Array.isArray(val) &&`);
  lines.push(`      val.length > 0 &&`);
  lines.push(`      typeof val[0] === "object" &&`);
  lines.push(`      val[0] !== null &&`);
  lines.push(`      "delayMs" in val[0]`);
  lines.push(`    ) return val;`);
  lines.push(`  }`);
  lines.push(`  throw new Error("No steps array found in ${escapeForString(stepsImport)}");`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`const _steps: any = _findSteps(_stepsModule as unknown as Record<string, unknown>);`);

  // --- Bundle ---
  lines.push(``);
  lines.push(`const _bundle = {`);
  lines.push(`  id: ${JSON.stringify(input.scenarioId)},`);
  lines.push(`  steps: _steps,`);
  lines.push(`  narrationManifest: _manifest,`);
  lines.push(`};`);

  // --- App tree ---
  lines.push(``);
  lines.push(`function _App() {`);
  const open = input.providersPath ? `<_Providers>` : ``;
  const close = input.providersPath ? `</_Providers>` : ``;
  lines.push(`  return (`);
  lines.push(`    <div className={SCENAR_CLASS}>`);
  lines.push(`      ${open}`);
  lines.push(`      <DemoViewport canonicalWidth={${input.canonicalWidth}} shellHeight={${input.shellHeight}}>`);
  lines.push(`        <ScenarioPlayer bundle={_bundle}>`);
  lines.push(`          {(data: any, stepIndex: number) => renderStep(data, stepIndex)}`);
  lines.push(`        </ScenarioPlayer>`);
  lines.push(`      </DemoViewport>`);
  lines.push(`      ${close}`);
  lines.push(`    </div>`);
  lines.push(`  );`);
  lines.push(`}`);

  // --- Mount ---
  lines.push(``);
  lines.push(`const _rootEl = document.getElementById("root");`);
  lines.push(`if (!_rootEl) throw new Error("Embed root element #root not found");`);
  lines.push(`createRoot(_rootEl).render(<_App />);`);
  lines.push(``);

  return lines.join("\n");
}

/**
 * Produce the index.html that boots the embed. The entry is referenced as an
 * external module script (`<script type="module" src>`) — never inline — so the
 * server CSP (`script-src 'self'`) is satisfied without loosening.
 */
export function generateEmbedHtml(scenarioId: string, entryFileName: string): string {
  return [
    `<!doctype html>`,
    `<html lang="en">`,
    `  <head>`,
    `    <meta charset="utf-8" />`,
    `    <meta name="viewport" content="width=device-width, initial-scale=1" />`,
    `    <title>${escapeHtml(scenarioId)}</title>`,
    `  </head>`,
    `  <body>`,
    `    <div id="root"></div>`,
    `    <script type="module" src=${JSON.stringify("./" + entryFileName)}></script>`,
    `  </body>`,
    `</html>`,
    ``,
  ].join("\n");
}

/** Convert a filesystem path to posix separators (for bundler imports). */
function toPosix(fsPath: string): string {
  return fsPath.split(posix.sep === "/" ? /\\/ : /[\\/]/).join("/");
}

function escapeForString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
