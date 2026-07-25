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
 * Pure function, no side effects — the caller writes the result to disk.
 */
export function generateEmbedEntry(input: EmbedEntryInput): string {
  const scenarioPath = toPosix(input.scenarioDir);
  const stepsImport = `${scenarioPath}/steps`;
  const renderImport = toPosix(input.renderFilePath).replace(/\.[^.]+$/, "");

  const lines: string[] = [];

  // --- Imports ---
  // React hooks drive the host-side interaction system (the same one the
  // in-app player wires): step tracking, cursor target, ripple/drag flags, and
  // the viewport transform. Without these, the embed would render content but
  // silently drop every cursor move and mid-step interaction.
  lines.push(`import { useCallback, useRef, useState } from "react";`);
  lines.push(`import { createRoot } from "react-dom/client";`);
  const reactImports = [
    "ScenarioPlayer",
    "DemoViewport",
    "SCENAR_CLASS",
    "Cursor",
    "useStepInteractions",
    "ViewportTransformLayer",
    "VIEWPORT_TRANSFORM_IDENTITY",
  ];
  if (input.hasNarration) reactImports.push("useNarrationManifest");
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

  // --- Narration manifest URL resolver (stable module-level reference) ---
  // The manifest is fetched at runtime from its own relative location so that
  // useNarrationManifest resolves each clip src against it (audio lives under
  // ./narration/). A stable resolver avoids refetch-on-every-render.
  if (input.hasNarration) {
    lines.push(``);
    lines.push(`const _resolveManifestUrl = () => "./narration/manifest.json";`);
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
  // contract and ViewportTransformLayer's "Cursor must be a sibling" invariant):
  //   DemoViewport(containerRef)
  //     └ ViewportTransformLayer(transform)
  //         └ ScenarioPlayer(embed, onStepChange)
  //     └ Cursor(target, containerRef)   ← sibling, not a child
  // `useStepInteractions` reads the current step's `interactions` and drives the
  // cursor / ripple / drag / viewport state, synced to narration duration.
  const manifestExpr = input.hasNarration ? "_manifest" : "undefined";
  lines.push(``);
  lines.push(`function _App() {`);
  if (input.hasNarration) {
    lines.push(`  const _manifest = useNarrationManifest(${JSON.stringify(input.scenarioId)}, _resolveManifestUrl);`);
  }
  lines.push(`  const _containerRef = useRef<HTMLDivElement>(null);`);
  lines.push(`  const [_stepIndex, _setStepIndex] = useState(0);`);
  lines.push(`  const [_cursorTarget, _setCursorTarget] = useState<string | undefined>(undefined);`);
  lines.push(`  const [_showRipple, _setShowRipple] = useState(true);`);
  lines.push(`  const [_dragging, _setDragging] = useState(false);`);
  lines.push(`  const [_viewport, _setViewport] = useState(VIEWPORT_TRANSFORM_IDENTITY);`);
  lines.push(``);
  // Reset the cursor when the step changes so a prior step's target never
  // lingers; the new step's interactions re-set it at their scheduled time.
  lines.push(`  const _handleStepChange = useCallback((_data: any, index: number) => {`);
  lines.push(`    _setStepIndex(index);`);
  lines.push(`    _setCursorTarget(undefined);`);
  lines.push(`  }, []);`);
  lines.push(``);
  lines.push(`  useStepInteractions({`);
  lines.push(`    stepIndex: _stepIndex,`);
  lines.push(`    narrationManifest: ${manifestExpr},`);
  lines.push(`    containerRef: _containerRef,`);
  lines.push(`    setCursorTarget: _setCursorTarget,`);
  lines.push(`    setShowRipple: _setShowRipple,`);
  lines.push(`    setDragging: _setDragging,`);
  lines.push(`    setViewportTransform: _setViewport,`);
  lines.push(`    steps: _steps,`);
  lines.push(`  });`);
  lines.push(``);
  lines.push(`  const _bundle = {`);
  lines.push(`    id: ${JSON.stringify(input.scenarioId)},`);
  lines.push(`    steps: _steps,`);
  lines.push(`    narrationManifest: ${manifestExpr},`);
  lines.push(`  };`);
  const open = input.providersPath ? `<_Providers>` : ``;
  const close = input.providersPath ? `</_Providers>` : ``;
  lines.push(`  return (`);
  lines.push(`    <div className={_rootClass}>`);
  lines.push(`      ${open}`);
  lines.push(`      <DemoViewport containerRef={_containerRef} canonicalWidth={${input.canonicalWidth}} shellHeight={${input.shellHeight}}>`);
  lines.push(`        <ViewportTransformLayer transform={_viewport}>`);
  lines.push(`          <ScenarioPlayer bundle={_bundle} embed onStepChange={_handleStepChange}>`);
  lines.push(`            {(data: any, stepIndex: number) => renderStep(data, stepIndex)}`);
  lines.push(`          </ScenarioPlayer>`);
  lines.push(`        </ViewportTransformLayer>`);
  lines.push(`        <Cursor target={_cursorTarget} containerRef={_containerRef} showRipple={_showRipple} isDragging={_dragging} />`);
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
 */
export function generateEmbedHtml(scenarioId: string, entryFileName: string): string {
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
