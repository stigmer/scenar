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
  /** Whether the scenario has a presenter manifest (+ clips). */
  hasPresenter: boolean;
  /** Absolute path to the providers file, or null if none found. */
  providersPath: string | null;
  fps: number;
  width: number;
  height: number;
  compositionId: string;
  /** Burn step captions into the video (`scenar render --captions`). */
  captions: boolean;
  /**
   * Canonical viewport the scenario lays out at, resolved by `runRender`
   * (explicit `--viewport` > authored > pack default, scenar#29). Always
   * present: an auto-generated entry always mounts the full presentation
   * stack in the composition (scenar#35) — a bare, unscaled player was
   * never a meaningful render.
   */
  viewport: { readonly widthPx: number; readonly heightPx: number };
  /** Float step content on the stage backdrop (`--stage`). */
  stage?: boolean;
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
    `import { ScenarioComposition, applyTitleCards, calculateScenarioTimeline } from "@scenar/remotion";`,
  );
  lines.push(`import { SCENAR_CLASS } from "@scenar/react";`);
  // The same stylesheet pair the packed embed entry loads: without them,
  // authored step content built on @scenar/react (shells, page templates)
  // renders unstyled — black frames in the MP4 (scenar#23). Remotion's
  // bundler handles plain CSS imports natively; styles.css is the
  // self-contained build, so no Tailwind processing is needed. The
  // composition root carries SCENAR_CLASS (below) so the `.scenar`-scoped
  // theme tokens resolve, exactly as the embed entry scopes its tree.
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

  if (input.hasPresenter) {
    const presenterManifestPath = `${scenarioPath}/presenter/manifest.json`;
    lines.push(`import _presenterManifest from ${JSON.stringify(presenterManifestPath)};`);
  } else {
    lines.push(`const _presenterManifest = undefined;`);
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

  // --- Soundtrack resolution (mirror of the CLI's findAuthoredSoundtrack) ---
  // Discovered from the very module the bundle bakes in, at module-eval
  // time, so the render can never disagree with the authored config: a
  // scenario-shaped export (createScenario) wins, then a `soundtrack`
  // named export; absent means no soundtrack.

  lines.push(``);
  lines.push(`function _findSoundtrack(mod: Record<string, unknown>): any {`);
  lines.push(`  for (const val of Object.values(mod)) {`);
  lines.push(`    if (`);
  lines.push(`      typeof val === "object" && val !== null && !Array.isArray(val) &&`);
  lines.push(`      "soundtrack" in val &&`);
  lines.push(`      Array.isArray((val as any).steps) && (val as any).steps.length > 0 &&`);
  lines.push(`      typeof (val as any).steps[0] === "object" && (val as any).steps[0] !== null &&`);
  lines.push(`      "delayMs" in (val as any).steps[0]`);
  lines.push(`    ) return (val as any).soundtrack;`);
  lines.push(`  }`);
  lines.push(`  return (mod as any)["soundtrack"];`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`const _soundtrack: any = _findSoundtrack(_stepsModule as unknown as Record<string, unknown>);`);

  // --- Title cards resolution (mirror of the CLI's findAuthoredTitleCards) ---
  // Same discovery contract as _findSoundtrack. The config is discovered
  // here and applied immediately below — bundle assembly is THE one
  // card-synthesis point (applyTitleCards from @scenar/core, re-exported
  // by @scenar/remotion so no extra dependency is needed).

  lines.push(``);
  lines.push(`function _findTitleCards(mod: Record<string, unknown>): any {`);
  lines.push(`  for (const val of Object.values(mod)) {`);
  lines.push(`    if (`);
  lines.push(`      typeof val === "object" && val !== null && !Array.isArray(val) &&`);
  lines.push(`      "titleCards" in val &&`);
  lines.push(`      Array.isArray((val as any).steps) && (val as any).steps.length > 0 &&`);
  lines.push(`      typeof (val as any).steps[0] === "object" && (val as any).steps[0] !== null &&`);
  lines.push(`      "delayMs" in (val as any).steps[0]`);
  lines.push(`    ) return (val as any).titleCards;`);
  lines.push(`  }`);
  lines.push(`  return (mod as any)["titleCards"];`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`const _titleCards: any = _findTitleCards(_stepsModule as unknown as Record<string, unknown>);`);

  // --- Bundle + timeline ---
  // Card synthesis runs before the timeline calculation so an intro or
  // outro card lengthens durationInFrames exactly like an authored step.

  lines.push(``);
  lines.push(`const _applied = applyTitleCards(_steps, _manifest, _titleCards, _presenterManifest);`);
  lines.push(`const _bundle = {`);
  lines.push(`  id: ${JSON.stringify(input.scenarioId)},`);
  lines.push(`  steps: _applied.steps as any,`);
  lines.push(`  narrationManifest: _applied.narrationManifest,`);
  lines.push(`  soundtrack: _soundtrack,`);
  lines.push(`  presenterManifest: _applied.presenterManifest,`);
  lines.push(`};`);
  lines.push(``);
  lines.push(
    `const _timeline = calculateScenarioTimeline(_bundle.steps, _bundle.narrationManifest, ${input.fps});`,
  );

  // --- Video root component ---

  lines.push(``);
  lines.push(`function _VideoRoot() {`);

  // `captions`/`viewport`/`stage` are baked into the generated JSX (not
  // read at render time): the entry is written per render invocation, so
  // each flag's value IS the render's configuration — same treatment as
  // fps/width/height above.
  const compositionProps = ["bundle={_bundle}"];
  if (input.captions) compositionProps.push("captions");
  compositionProps.push(
    `viewport={{ widthPx: ${input.viewport.widthPx}, heightPx: ${input.viewport.heightPx} }}`,
  );
  if (input.stage) compositionProps.push("stage");
  const compositionOpen = `<ScenarioComposition ${compositionProps.join(" ")}>`;

  if (input.providersPath) {
    // The inner AbsoluteFill is load-bearing: ScenarioComposition sizes its
    // player through a CSS height chain, and providers are not required to
    // be height-transparent — a provider that renders a real wrapper element
    // with auto height (e.g. a theme-scope div) would otherwise collapse the
    // chain, shrinking cards to content height and authored step surfaces to
    // zero (black frames — scenar#33). Sandwiching the provider between two
    // absolute fills makes the entry's layout guarantee independent of
    // whatever the provider renders.
    lines.push(`  return (`);
    lines.push(`    <AbsoluteFill className={SCENAR_CLASS}>`);
    lines.push(`      <_Providers>`);
    lines.push(`        <AbsoluteFill>`);
    lines.push(`          ${compositionOpen}`);
    lines.push(`            {(data: any, stepIndex: number) => renderStep(data, stepIndex)}`);
    lines.push(`          </ScenarioComposition>`);
    lines.push(`        </AbsoluteFill>`);
    lines.push(`      </_Providers>`);
    lines.push(`    </AbsoluteFill>`);
    lines.push(`  );`);
  } else {
    lines.push(`  return (`);
    lines.push(`    <AbsoluteFill className={SCENAR_CLASS}>`);
    lines.push(`      ${compositionOpen}`);
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
