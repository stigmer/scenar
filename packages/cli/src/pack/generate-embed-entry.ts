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
  /** Whether the scenario has a presenter manifest (+ clips). */
  hasPresenter: boolean;
  /** Absolute path to .scenar/providers.tsx, or null if none. */
  providersPath: string | null;
  /** Canonical viewport width in px (children render at this width). */
  canonicalWidth: number;
  /** Shell height in px, exposed as --scenar-shell-height. */
  shellHeight: number;
  /**
   * Wrap each step's content in `<ScenarioStage>` (backdrop + window shadow),
   * and paint the backdrop in the static HTML so it shows before the entry
   * script runs. Opt-in: staged embeds give up the transparent canvas.
   */
  stage?: boolean;
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
 * Interactions: the entry wires the full host-side interaction system —
 * `useStepInteractions` + `<Cursor>` + `<ViewportTransformLayer>` — so packed
 * embeds run the same narration-synced cursor moves, clicks, typing, hovers,
 * drags, scrolls, and viewport transitions as the in-app player. (`ScenarioPlayer`
 * itself owns none of this; the host must wire it, per DemoViewport's contract.)
 *
 * Theme: the embed reads `?theme` from its own URL and applies the `dark` class
 * alongside `SCENAR_CLASS` when `theme=dark` (matching the `.scenar.dark` token
 * selector). The default is light, so existing embeds are unaffected; a host can
 * theme-sync simply by framing `…/?theme=dark`.
 *
 * Captions (`?captions=1`): same frame-time-preference family as `?theme` —
 * enables the player's step captions (narration text as a subtitle overlay,
 * with a CC toggle in the control bar). Absent means off, preserving prior
 * behavior.
 *
 * Capture (`?shot`): with a `shot` query param present, the entry mounts
 * `ScenarioCaptureMount` instead of the playback tree — the TimeSource-driven
 * catch-up mount behind `scenar shoot` (DD-02). The driver installs on
 * `window.__scenarShot`; failures surface on `window.__scenarShotError`.
 * `?shot=<name>` additionally auto-walks to that shot, so an author can
 * eyeball any still in a plain browser. When the scenario has narration, the
 * capture branch fetches the manifest itself and fails LOUDLY on error —
 * step durations are narration-driven, so a silent fallback would capture
 * every shot at the wrong time (which is why it must not reuse
 * `useNarrationManifest`, whose fetch failure is silent by design).
 *
 * Pure function, no side effects — the caller writes the result to disk.
 */
/**
 * The import specifier the generated entry uses for the scenario's steps
 * module (extensionless — Vite resolves .ts/.tsx). Exported so pack-time
 * tooling (`collect-pack-shots`) loads the very same module the bundle bakes
 * in, rather than re-deriving a path that could drift from it.
 */
export function stepsModuleSpecifier(scenarioDir: string): string {
  return `${toPosix(scenarioDir)}/steps`;
}

export function generateEmbedEntry(input: EmbedEntryInput): string {
  const stepsImport = stepsModuleSpecifier(input.scenarioDir);
  const renderImport = toPosix(input.renderFilePath).replace(/\.[^.]+$/, "");

  const lines: string[] = [];

  // --- Imports ---
  // React hooks drive the host-side interaction system (the same one the
  // in-app player wires): step tracking, cursor target, ripple/drag flags, and
  // the viewport transform. Without these, the embed would render content but
  // silently drop every cursor move and mid-step interaction.
  lines.push(`import { useCallback, useMemo, useRef, useState } from "react";`);
  lines.push(`import { createRoot } from "react-dom/client";`);
  const reactImports = [
    "ScenarioPlayer",
    "DemoViewport",
    "SCENAR_CLASS",
    "Cursor",
    "useStepInteractions",
    "ViewportTransformLayer",
    "VIEWPORT_TRANSFORM_IDENTITY",
    "ScenarioCaptureMount",
    "applyTitleCards",
  ];
  if (input.stage) reactImports.push("ScenarioStage");
  if (input.hasNarration) reactImports.push("useNarrationManifest");
  if (input.hasPresenter) reactImports.push("usePresenterManifest");
  lines.push(`import { ${reactImports.join(", ")} } from "@scenar/react";`);
  lines.push(`import "@scenar/react/theme.css";`);
  lines.push(`import "@scenar/react/styles.css";`);
  lines.push(`import { renderStep } from ${JSON.stringify(renderImport)};`);
  lines.push(`import * as _stepsModule from ${JSON.stringify(stepsImport)};`);

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

  // --- Soundtrack resolution (mirror of the CLI's findAuthoredSoundtrack) ---
  // Same runtime-discovery contract as _findSteps: read from the very module
  // the bundle bakes in, so the embed can never disagree with the authored
  // config. Pack copies the referenced assets (music, the built-in SFX set)
  // into the bundle; the sources below point at those copies.
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
  lines.push(``);
  lines.push(`const _soundtrackSources = {`);
  lines.push(`  sfx: { click: "./soundtrack/sfx/click.mp3", keystroke: "./soundtrack/sfx/keystroke.mp3" },`);
  lines.push(`};`);

  // --- Title cards resolution (mirror of the CLI's findAuthoredTitleCards) ---
  // Same runtime-discovery contract as _findSoundtrack. Applied inside
  // _App (the manifest arrives asynchronously and padding must track it);
  // pack copies the referenced logo into the bundle, so the authored
  // relative src resolves against the embed page. Capture mode (?shot)
  // deliberately stays on the AUTHORED steps: shots live on authored
  // steps and cards declare none.
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

  // --- Narration manifest URL resolver (stable module-level reference) ---
  // The manifest is fetched at runtime from its own relative location so that
  // useNarrationManifest resolves each clip src against it (audio lives under
  // ./narration/). A stable resolver avoids refetch-on-every-render.
  if (input.hasNarration) {
    lines.push(``);
    lines.push(`const _resolveManifestUrl = () => "./narration/manifest.json";`);
  }

  // --- Presenter manifest URL resolver (same contract as narration) ---
  // The clips live under ./presenter/; usePresenterManifest resolves each
  // clip's relative src against the manifest's own location.
  if (input.hasPresenter) {
    lines.push(``);
    lines.push(`const _resolvePresenterManifestUrl = () => "./presenter/manifest.json";`);
  }

  // --- Theme: opt-in dark via ?theme=dark (default light; backward-compatible) ---
  // Read once at module load from the embed's own URL. `theme=dark` adds the
  // `dark` class next to SCENAR_CLASS so the `.scenar.dark` tokens apply; any
  // other value (including absent) renders light, preserving prior behavior.
  lines.push(``);
  lines.push(`const _theme = (() => {`);
  lines.push(`  try { return new URLSearchParams(window.location.search).get("theme"); }`);
  lines.push(`  catch { return null; }`);
  lines.push(`})();`);
  lines.push(`const _rootClass = _theme === "dark" ? SCENAR_CLASS + " dark" : SCENAR_CLASS;`);

  // --- Captions: opt-in via ?captions=1 (default off; backward-compatible) ---
  // Same family as ?theme: a frame-time presentation preference the host
  // chooses per embed instance (an iframe host writes no JSX, so the player's
  // `captions` prop is reachable only through the URL). Read once at module
  // load; "1" and "true" both enable, anything else (including absent)
  // preserves prior behavior.
  lines.push(``);
  lines.push(`const _captions = (() => {`);
  lines.push(`  try {`);
  lines.push(`    const v = new URLSearchParams(window.location.search).get("captions");`);
  lines.push(`    return v === "1" || v === "true";`);
  lines.push(`  } catch { return false; }`);
  lines.push(`})();`);

  // --- Capture mode: ?shot (bare = driver only; ?shot=<name> = auto-walk) ---
  // Read the same way as _theme: once, at module load, outside React. A null
  // value (param absent) means normal playback; "" (bare ?shot) means capture
  // mode without an auto-walk target.
  lines.push(``);
  lines.push(`const _shotParam = (() => {`);
  lines.push(`  try { return new URLSearchParams(window.location.search).get("shot"); }`);
  lines.push(`  catch { return null; }`);
  lines.push(`})();`);

  // --- Page canvas: transparent when framed, theme surface when top-level ---
  // The static HTML keeps html/body transparent (see generateEmbedHtml): a
  // framed embed's canvas then shows the *host page's* background through any
  // pixel the tour doesn't paint (aspect-ratio rounding slivers, load-in), so
  // an embed can never flash a white band on a dark docs page. Do NOT pin
  // `document.documentElement.style.colorScheme` to the resolved theme here —
  // the `light dark` meta must stay authoritative, because a scheme mismatch
  // with the framing document is exactly what makes browsers force an opaque
  // white canvas. Top-level (scenar serve verification, direct bundle links)
  // has no host background to show through, so paint the theme surface token
  // for an intentional-looking page instead of the browser's default white.
  // The body gets the scenar root class so `--scenar-surface` resolves there —
  // referencing the token keeps this in lockstep with the palette instead of
  // duplicating hex values that would drift.
  lines.push(``);
  lines.push(`if (window.parent === window) {`);
  lines.push(`  document.body.classList.add(..._rootClass.split(" "));`);
  lines.push(`  document.body.style.background = "var(--scenar-surface)";`);
  lines.push(`}`);

  // --- App tree ---
  // The structure mirrors the in-app demo wiring exactly (see DemoViewport's
  // and ViewportTransformLayer's contracts):
  //   DemoViewport(containerRef)
  //     └ ViewportTransformLayer(transform, contentRef=cameraRef)
  //         └ ScenarioPlayer(embed, onStepChange)
  //         └ Cursor(target, containerRef=cameraRef)   ← child of the camera
  // The cursor lives INSIDE the camera so it scales and pans with the content
  // during viewport transitions — like a recorded pointer under a camera zoom.
  // Both the cursor and the viewport-transition target math take the camera's
  // contentRef so canonical coordinates stay correct at any camera state.
  // `useStepInteractions` reads the current step's `interactions` and drives the
  // cursor / ripple / drag / viewport state, synced to narration duration.
  const manifestExpr = input.hasNarration ? "_manifest" : "undefined";
  const presenterExpr = input.hasPresenter ? "_presenterManifest" : "undefined";
  lines.push(``);
  lines.push(`function _App() {`);
  if (input.hasNarration) {
    lines.push(`  const _manifest = useNarrationManifest(${JSON.stringify(input.scenarioId)}, _resolveManifestUrl);`);
  }
  if (input.hasPresenter) {
    lines.push(`  const _presenterManifest = usePresenterManifest(${JSON.stringify(input.scenarioId)}, _resolvePresenterManifestUrl);`);
  }
  lines.push(`  const _containerRef = useRef<HTMLDivElement>(null);`);
  lines.push(`  const _cameraRef = useRef<HTMLDivElement>(null);`);
  lines.push(`  const [_stepIndex, _setStepIndex] = useState(0);`);
  lines.push(`  const [_cursorTarget, _setCursorTarget] = useState<string | undefined>(undefined);`);
  lines.push(`  const [_showRipple, _setShowRipple] = useState(true);`);
  lines.push(`  const [_dragging, _setDragging] = useState(false);`);
  lines.push(`  const [_viewport, _setViewport] = useState(VIEWPORT_TRANSFORM_IDENTITY);`);
  lines.push(``);
  // Reset the cursor when the step changes so a prior step's target never
  // lingers; the new step's interactions re-set it at their scheduled time.
  // One handler feeds both step-change callbacks: authored steps deliver
  // data, card steps deliver the card — the wiring needs only the index,
  // and it must track BOTH so card-step interactions (the outro's
  // cursor-clear and viewport-reset housekeeping) reach the scheduler.
  lines.push(`  const _handleStepChange = useCallback((_dataOrCard: any, index: number) => {`);
  lines.push(`    _setStepIndex(index);`);
  lines.push(`    _setCursorTarget(undefined);`);
  lines.push(`  }, []);`);
  lines.push(``);
  // Card synthesis: bundle assembly is THE one expansion point. Memoized
  // on the manifests (the only async inputs) so the steps identity stays
  // stable across renders and the interaction scheduler is not re-armed.
  const appliedDeps = [manifestExpr, presenterExpr]
    .filter((expr) => expr !== "undefined")
    .join(", ");
  lines.push(`  const _applied = useMemo(`);
  lines.push(`    () => applyTitleCards(_steps as any, ${manifestExpr}, _titleCards, ${presenterExpr}),`);
  lines.push(`    [${appliedDeps}],`);
  lines.push(`  );`);
  lines.push(``);
  lines.push(`  useStepInteractions({`);
  lines.push(`    stepIndex: _stepIndex,`);
  lines.push(`    narrationManifest: _applied.narrationManifest,`);
  lines.push(`    containerRef: _containerRef,`);
  lines.push(`    cameraRef: _cameraRef,`);
  lines.push(`    setCursorTarget: _setCursorTarget,`);
  lines.push(`    setShowRipple: _setShowRipple,`);
  lines.push(`    setDragging: _setDragging,`);
  lines.push(`    setViewportTransform: _setViewport,`);
  lines.push(`    steps: _applied.steps,`);
  lines.push(`  });`);
  lines.push(``);
  lines.push(`  const _bundle = {`);
  lines.push(`    id: ${JSON.stringify(input.scenarioId)},`);
  lines.push(`    steps: _applied.steps as any,`);
  lines.push(`    narrationManifest: _applied.narrationManifest,`);
  lines.push(`    soundtrack: _soundtrack,`);
  lines.push(`    presenterManifest: _applied.presenterManifest,`);
  lines.push(`  };`);
  const open = input.providersPath ? `<_Providers>` : ``;
  const close = input.providersPath ? `</_Providers>` : ``;
  lines.push(`  return (`);
  lines.push(`    <div className={_rootClass}>`);
  lines.push(`      ${open}`);
  // Staged embeds wrap each step's content — not the player chrome — in the
  // stage, inside the camera, so a zoom scales the whole recording, backdrop
  // included, while controls keep overlaying the stable content box.
  const stepRender = input.stage
    ? `{(data: any, stepIndex: number) => <ScenarioStage>{renderStep(data, stepIndex)}</ScenarioStage>}`
    : `{(data: any, stepIndex: number) => renderStep(data, stepIndex)}`;
  lines.push(`      <DemoViewport containerRef={_containerRef} canonicalWidth={${input.canonicalWidth}} shellHeight={${input.shellHeight}}>`);
  lines.push(`        <ViewportTransformLayer transform={_viewport} contentRef={_cameraRef}>`);
  // embedViewport mirrors DemoViewport's numbers on purpose: the bundle
  // announces the exact canonical size it lays out at, so a host can adopt
  // iframe-as-screen scaling (see @scenar/embed's mount).
  lines.push(`          <ScenarioPlayer bundle={_bundle} embed embedViewport={{ widthPx: ${input.canonicalWidth}, heightPx: ${input.shellHeight} }} captions={_captions} soundtrackSources={_soundtrackSources} onStepChange={_handleStepChange} onCardStepChange={_handleStepChange}>`);
  lines.push(`            ${stepRender}`);
  lines.push(`          </ScenarioPlayer>`);
  lines.push(`          <Cursor target={_cursorTarget} containerRef={_cameraRef} showRipple={_showRipple} isDragging={_dragging} />`);
  lines.push(`        </ViewportTransformLayer>`);
  lines.push(`      </DemoViewport>`);
  lines.push(`      ${close}`);
  lines.push(`    </div>`);
  lines.push(`  );`);
  lines.push(`}`);

  // --- Capture mount (?shot) ---
  // The whole capture tree lives in @scenar/react (ScenarioCaptureMount);
  // this branch only feeds it the same inputs the playback tree gets and
  // wires the window contract `scenar shoot` consumes: the driver on
  // `window.__scenarShot`, failures on `window.__scenarShotError`. The
  // narration manifest is fetched HERE, before mounting, and errors are
  // fatal — shot times are narration-driven, so capturing without the
  // manifest would silently shoot every frame at the wrong moment.
  lines.push(``);
  lines.push(`async function _mountCapture(rootEl: HTMLElement) {`);
  if (input.hasNarration) {
    lines.push(`  const _manifestResponse = await fetch("./narration/manifest.json");`);
    lines.push(`  if (!_manifestResponse.ok) {`);
    lines.push(`    throw new Error(`);
    lines.push(`      "capture: failed to fetch ./narration/manifest.json (HTTP " +`);
    lines.push(`        _manifestResponse.status + ") — shot times are narration-driven, refusing to capture without it",`);
    lines.push(`    );`);
    lines.push(`  }`);
    lines.push(`  const _captureManifest = await _manifestResponse.json();`);
  } else {
    lines.push(`  const _captureManifest = undefined;`);
  }
  lines.push(`  createRoot(rootEl).render(`);
  lines.push(`    <div className={_rootClass}>`);
  lines.push(`      <ScenarioCaptureMount`);
  lines.push(`        scenarioId={${JSON.stringify(input.scenarioId)}}`);
  lines.push(`        steps={_steps}`);
  lines.push(`        renderStep={renderStep}`);
  lines.push(`        canonicalWidth={${input.canonicalWidth}}`);
  lines.push(`        shellHeight={${input.shellHeight}}`);
  lines.push(`        narrationManifest={_captureManifest}`);
  lines.push(`        stage={${input.stage ? "true" : "false"}}`);
  lines.push(`        providers={${input.providersPath ? "_Providers" : "undefined"}}`);
  lines.push(`        onReady={(driver: any) => {`);
  lines.push(`          (window as any).__scenarShot = driver;`);
  lines.push(`          if (_shotParam) {`);
  lines.push(`            const _target = driver.shots.find((s: any) => s.name === _shotParam);`);
  lines.push(`            if (!_target) {`);
  lines.push(`              (window as any).__scenarShotError =`);
  lines.push(`                'no shot named "' + _shotParam + '" — declared: ' +`);
  lines.push(`                (driver.shots.map((s: any) => s.name).join(", ") || "(none)");`);
  lines.push(`              return;`);
  lines.push(`            }`);
  lines.push(`            void driver.walkTo(_target.timeMs);`);
  lines.push(`          }`);
  lines.push(`        }}`);
  lines.push(`        onError={(error: any) => {`);
  lines.push(`          (window as any).__scenarShotError = error?.message ?? String(error);`);
  lines.push(`        }}`);
  lines.push(`      />`);
  lines.push(`    </div>,`);
  lines.push(`  );`);
  lines.push(`}`);

  // --- Mount ---
  lines.push(``);
  lines.push(`const _rootEl = document.getElementById("root");`);
  lines.push(`if (!_rootEl) throw new Error("Embed root element #root not found");`);
  lines.push(`if (_shotParam !== null) {`);
  lines.push(`  _mountCapture(_rootEl).catch((error) => {`);
  lines.push(`    (window as any).__scenarShotError = error instanceof Error ? error.message : String(error);`);
  lines.push(`  });`);
  lines.push(`} else {`);
  lines.push(`  createRoot(_rootEl).render(<_App />);`);
  lines.push(`}`);
  lines.push(``);

  return lines.join("\n");
}

/**
 * Staged pre-paint backdrop — a hand-maintained mirror of the
 * `--scenar-backdrop-*` tokens in @scenar/react's theme/tokens.css (the token
 * stylesheet is not loadable before the entry script runs, so the values are
 * duplicated here by necessity). The token names, hex values, and gradient
 * geometry are kept byte-identical to tokens.css; the drift-lock test in
 * `pack-generate-embed-entry.test.ts` reads tokens.css and fails the build
 * of anyone who retunes one side without the other.
 *
 * The theme split lives in the *colors* via `light-dark()` — a <color>-only
 * function, so each custom property resolves against the propagated
 * `color-scheme` while the mesh geometry is written once. (An earlier
 * revision wrapped whole gradients in `light-dark()`, which is invalid CSS
 * that browsers drop silently — the pre-paint never actually painted.)
 */
export const STAGE_BACKDROP_COLORS: ReadonlyArray<{
  readonly token: string;
  readonly light: string;
  readonly dark: string;
}> = [
  { token: "--scenar-backdrop-glow-1", light: "#b7d4f2", dark: "#1c3a63" },
  { token: "--scenar-backdrop-glow-2", light: "#e3d0ec", dark: "#372a5e" },
  { token: "--scenar-backdrop-glow-3", light: "#b4c4ea", dark: "#142647" },
  { token: "--scenar-backdrop-base-1", light: "#e4ecf7", dark: "#101828" },
  { token: "--scenar-backdrop-base-2", light: "#e6e1f0", dark: "#14122a" },
];

/** Mesh geometry, one layer per line — mirrors `--scenar-backdrop` in tokens.css. */
export const STAGE_BACKDROP_MESH: readonly string[] = [
  "radial-gradient(120% 100% at 12% 8%, var(--scenar-backdrop-glow-1) 0%, transparent 55%)",
  "radial-gradient(110% 95% at 88% 12%, var(--scenar-backdrop-glow-2) 0%, transparent 55%)",
  "radial-gradient(130% 110% at 70% 100%, var(--scenar-backdrop-glow-3) 0%, transparent 60%)",
  "linear-gradient(135deg, var(--scenar-backdrop-base-1) 0%, var(--scenar-backdrop-base-2) 100%)",
];

/**
 * Produce the index.html that boots the embed. The entry is referenced as an
 * external module script (`<script type="module" src>`) — never inline — so the
 * server CSP (`script-src 'self'`) is satisfied without loosening.
 *
 * Canvas contract: the page declares `color-scheme: light dark` and keeps
 * html/body transparent. When the embed is framed by a same-origin host (the
 * shipped stigmer.ai layout), the browser propagates the host's color scheme
 * into the frame; because the embed supports both schemes they always match,
 * so the iframe canvas stays *transparent* — every pixel the tour doesn't
 * paint shows the host page's own background, in both themes, even before the
 * entry script loads. (A scheme mismatch is what makes browsers force an
 * opaque white canvas — the historical "white band under the embed".) The
 * margin reset guards against a host stylesheet-less load; the entry paints a
 * theme surface only when the page is top-level (see generateEmbedEntry).
 *
 * Staged embeds (`--stage`) deliberately trade that transparency away: the
 * scenario floats on a backdrop, so the page pre-paints the same backdrop in
 * static CSS — before the entry script runs — and there is no flash when the
 * React-rendered stage takes over. See STAGE_BACKDROP_COLORS for the
 * mirroring contract. Do NOT pin `colorScheme` here either — the
 * `light dark` meta stays authoritative.
 */
export function generateEmbedHtml(
  scenarioId: string,
  entryFileName: string,
  stage = false,
): string {
  const bodyBackground = stage
    ? [
        `      body {`,
        ...STAGE_BACKDROP_COLORS.map(
          ({ token, light, dark }) => `        ${token}: light-dark(${light}, ${dark});`,
        ),
        `        background:`,
        ...STAGE_BACKDROP_MESH.map(
          (layer, i) =>
            `          ${layer}${i === STAGE_BACKDROP_MESH.length - 1 ? ";" : ","}`,
        ),
        `      }`,
      ]
    : [];
  return [
    `<!doctype html>`,
    `<html lang="en">`,
    `  <head>`,
    `    <meta charset="utf-8" />`,
    `    <meta name="viewport" content="width=device-width, initial-scale=1" />`,
    `    <meta name="color-scheme" content="light dark" />`,
    `    <title>${escapeHtml(scenarioId)}</title>`,
    `    <style>`,
    `      html, body { margin: 0; background: transparent; }`,
    ...bodyBackground,
    `    </style>`,
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
