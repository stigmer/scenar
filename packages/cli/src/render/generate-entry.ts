import { posix } from "node:path";

/**
 * Inputs required to generate a Remotion entry file for a scenario.
 *
 * All paths are absolute filesystem paths. The generator converts them
 * to posix-style forward-slash paths suitable for webpack imports.
 */
export interface EntryGeneratorInput {
  /** Absolute path to the scenario directory (e.g. /proj/scenarios/my-tour). */
  scenarioDir: string;
  /** Absolute path to the file that exports renderStep. */
  renderFilePath: string;
  /** Scenario ID derived from the directory basename. */
  scenarioId: string;
  /** Whether the scenario has a narration manifest. */
  hasNarration: boolean;
  /** Absolute path to the providers file, or null if none found. */
  providersPath: string | null;
  fps: number;
  width: number;
  height: number;
  compositionId: string;
}

/**
 * Produce the TypeScript source for a Remotion entry file that renders
 * a single scenario.
 *
 * The output is a self-contained `index.tsx` that can be passed to
 * `@remotion/bundler.bundle({ entryPoint })`. All imports use absolute
 * paths so the file works from any temp directory.
 *
 * The steps file may export the steps array under any name (e.g.
 * `awsConnectionTourSteps`). Rather than guessing the export name,
 * the generated entry uses a namespace import and duck-types the array
 * at module-evaluation time — the same heuristic the CLI's own
 * `loadStepsFromTs` uses.
 *
 * This is a pure function with no side effects — callers write the
 * result to disk and manage cleanup.
 */
export function generateRemotionEntry(input: EntryGeneratorInput): string {
  const scenarioPath = toPosix(input.scenarioDir);
  const stepsImport = `${scenarioPath}/steps`;
  const renderImport = toPosix(input.renderFilePath).replace(/\.[^.]+$/, "");

  const lines: string[] = [];

  // --- Imports ---

  lines.push(`import { registerRoot } from "remotion";`);
  lines.push(`import { Composition, AbsoluteFill } from "remotion";`);
  lines.push(
    `import { ScenarioComposition, calculateScenarioTimeline } from "@scenar/remotion";`,
  );
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

  // --- Steps resolution (duck-type the first array with delayMs) ---

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
  lines.push(`  throw new Error("No steps array found in ${stepsImport.replace(/"/g, '\\"')}");`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`const _steps: any = _findSteps(_stepsModule as unknown as Record<string, unknown>);`);

  // --- Bundle + timeline ---

  lines.push(``);
  lines.push(`const _bundle = {`);
  lines.push(`  id: ${JSON.stringify(input.scenarioId)},`);
  lines.push(`  steps: _steps,`);
  lines.push(`  narrationManifest: _manifest,`);
  lines.push(`};`);
  lines.push(``);
  lines.push(
    `const _timeline = calculateScenarioTimeline(_bundle.steps, _bundle.narrationManifest, ${input.fps});`,
  );

  // --- Video root component ---

  lines.push(``);
  lines.push(`function _VideoRoot() {`);

  if (input.providersPath) {
    lines.push(`  return (`);
    lines.push(`    <AbsoluteFill>`);
    lines.push(`      <_Providers>`);
    lines.push(`        <ScenarioComposition bundle={_bundle}>`);
    lines.push(`          {(data: any, stepIndex: number) => renderStep(data, stepIndex)}`);
    lines.push(`        </ScenarioComposition>`);
    lines.push(`      </_Providers>`);
    lines.push(`    </AbsoluteFill>`);
    lines.push(`  );`);
  } else {
    lines.push(`  return (`);
    lines.push(`    <AbsoluteFill>`);
    lines.push(`      <ScenarioComposition bundle={_bundle}>`);
    lines.push(`        {(data: any, stepIndex: number) => renderStep(data, stepIndex)}`);
    lines.push(`      </ScenarioComposition>`);
    lines.push(`    </AbsoluteFill>`);
    lines.push(`  );`);
  }

  lines.push(`}`);

  // --- Composition registration ---

  lines.push(``);
  lines.push(`const _RemotionRoot = () => (`);
  lines.push(`  <Composition`);
  lines.push(`    id=${JSON.stringify(input.compositionId)}`);
  lines.push(`    component={_VideoRoot}`);
  lines.push(`    fps={${input.fps}}`);
  lines.push(`    width={${input.width}}`);
  lines.push(`    height={${input.height}}`);
  lines.push(`    durationInFrames={_timeline.durationInFrames}`);
  lines.push(`  />`);
  lines.push(`);`);
  lines.push(``);
  lines.push(`registerRoot(_RemotionRoot);`);
  lines.push(``);

  return lines.join("\n");
}

/** Convert a filesystem path to posix separators (for webpack imports). */
function toPosix(fsPath: string): string {
  return fsPath.split(posix.sep === "/" ? /\\/ : /[\\/]/).join("/");
}
