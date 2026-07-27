import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  STAGE_BACKDROP_COLORS,
  STAGE_BACKDROP_MESH,
  generateEmbedEntry,
  generateEmbedHtml,
} from "../pack/generate-embed-entry.js";

const BASE = {
  scenarioDir: "/proj/scenarios/welcome-tour",
  renderFilePath: "/proj/scenarios/welcome-tour/index.tsx",
  scenarioId: "welcome-tour",
  canonicalWidth: 896,
  shellHeight: 480,
} as const;

describe("generateEmbedEntry", () => {
  it("mounts ScenarioPlayer into #root with the renderStep contract", () => {
    const src = generateEmbedEntry({ ...BASE, hasNarration: false, providersPath: null });
    expect(src).toContain('import { createRoot } from "react-dom/client";');
    expect(src).toContain('import { renderStep } from "/proj/scenarios/welcome-tour/index";');
    expect(src).toContain("<ScenarioPlayer bundle={_bundle} embed onStepChange={_handleStepChange}>");
    expect(src).toContain("renderStep(data, stepIndex)");
    expect(src).toContain('getElementById("root")');
  });

  it("wraps step content in ScenarioStage only when stage is requested", () => {
    const plain = generateEmbedEntry({ ...BASE, hasNarration: false, providersPath: null });
    expect(plain).not.toContain("ScenarioStage");

    const staged = generateEmbedEntry({
      ...BASE,
      hasNarration: false,
      providersPath: null,
      stage: true,
    });
    expect(staged).toContain("ScenarioStage");
    // The stage wraps the step's content inside the camera, not the player
    // chrome: it lives in the render prop.
    expect(staged).toContain(
      "<ScenarioStage>{renderStep(data, stepIndex)}</ScenarioStage>",
    );
  });

  it("imports the interaction primitives + React hooks the embed wiring needs", () => {
    const src = generateEmbedEntry({ ...BASE, hasNarration: false, providersPath: null });
    expect(src).toContain('import { useCallback, useRef, useState } from "react";');
    // ScenarioPlayer/DemoViewport/SCENAR_CLASS plus Cursor, useStepInteractions,
    // ViewportTransformLayer, VIEWPORT_TRANSFORM_IDENTITY all come from @scenar/react.
    expect(src).toContain(
      'import { ScenarioPlayer, DemoViewport, SCENAR_CLASS, Cursor, useStepInteractions, ViewportTransformLayer, VIEWPORT_TRANSFORM_IDENTITY } from "@scenar/react";',
    );
  });

  it("wires the host-side interaction system so packed embeds run interactions", () => {
    const src = generateEmbedEntry({ ...BASE, hasNarration: false, providersPath: null });
    // A shared container ref flows to DemoViewport, useStepInteractions, and Cursor.
    expect(src).toContain("const _containerRef = useRef<HTMLDivElement>(null);");
    expect(src).toContain("<DemoViewport containerRef={_containerRef}");
    // Step index is tracked from the player and fed to the interaction scheduler.
    expect(src).toContain("onStepChange={_handleStepChange}");
    expect(src).toContain("useStepInteractions({");
    expect(src).toContain("setCursorTarget: _setCursorTarget,");
    expect(src).toContain("setViewportTransform: _setViewport,");
    expect(src).toContain("cameraRef: _cameraRef,");
    expect(src).toContain("steps: _steps,");
    // The cursor lives INSIDE the camera layer with the camera's contentRef as
    // its container, so it scales and pans with the content during viewport
    // transitions — the documented contract on ViewportTransformLayer.
    expect(src).toContain(
      "<ViewportTransformLayer transform={_viewport} contentRef={_cameraRef}>",
    );
    expect(src).toContain(
      "<Cursor target={_cursorTarget} containerRef={_cameraRef} showRipple={_showRipple} isDragging={_dragging} />",
    );
    const cursorIndex = src.indexOf("<Cursor ");
    const layerCloseIndex = src.indexOf("</ViewportTransformLayer>");
    expect(cursorIndex).toBeGreaterThan(-1);
    expect(cursorIndex).toBeLessThan(layerCloseIndex);
  });

  it("feeds the narration manifest into the interaction scheduler when present", () => {
    const without = generateEmbedEntry({ ...BASE, hasNarration: false, providersPath: null });
    // No narration: interactions are timed by step delays only.
    expect(without).toContain("narrationManifest: undefined,");

    const withNarration = generateEmbedEntry({ ...BASE, hasNarration: true, providersPath: null });
    // With narration: both the bundle and useStepInteractions receive _manifest,
    // so interaction timing tracks the spoken-clip durations.
    expect(withNarration).toContain("narrationManifest: _manifest,");
    expect(withNarration).not.toContain("narrationManifest: undefined,");
  });

  it("imports the @scenar/react theme + styles so the bundle is self-contained", () => {
    const src = generateEmbedEntry({ ...BASE, hasNarration: false, providersPath: null });
    expect(src).toContain('import "@scenar/react/theme.css";');
    expect(src).toContain('import "@scenar/react/styles.css";');
  });

  it("scopes the tree with SCENAR_CLASS + DemoViewport sizing", () => {
    const src = generateEmbedEntry({ ...BASE, hasNarration: false, providersPath: null });
    expect(src).toContain("canonicalWidth={896}");
    expect(src).toContain("shellHeight={480}");
  });

  it("derives the root class from ?theme so dark is opt-in and the default stays light", () => {
    const src = generateEmbedEntry({ ...BASE, hasNarration: false, providersPath: null });
    // The container class is theme-derived, not a hardcoded SCENAR_CLASS.
    expect(src).toContain("className={_rootClass}");
    expect(src).not.toContain("className={SCENAR_CLASS}");
    // Reads the theme from the embed's own URL.
    expect(src).toContain('new URLSearchParams(window.location.search).get("theme")');
    // theme=dark adds the `dark` class (-> .scenar.dark tokens); else light.
    expect(src).toContain(
      'const _rootClass = _theme === "dark" ? SCENAR_CLASS + " dark" : SCENAR_CLASS;',
    );
  });

  it("paints the theme surface only when top-level, never when framed", () => {
    const src = generateEmbedEntry({ ...BASE, hasNarration: false, providersPath: null });
    // Top-level pages (scenar serve, direct links) get an intentional surface;
    // framed embeds must stay transparent so the host background shows through.
    expect(src).toContain("if (window.parent === window) {");
    expect(src).toContain('document.body.style.background = "var(--scenar-surface)";');
    // The entry must not pin color-scheme — the HTML's `light dark` meta is
    // what keeps a same-origin host's scheme matched (and the canvas
    // transparent); a JS override would reintroduce the opaque white canvas.
    expect(src).not.toContain("colorScheme");
  });

  it("fetches the narration manifest at runtime only when present", () => {
    const without = generateEmbedEntry({ ...BASE, hasNarration: false, providersPath: null });
    expect(without).toContain("narrationManifest: undefined,");
    expect(without).not.toContain("useNarrationManifest");
    expect(without).not.toContain("import _manifest");

    const withNarration = generateEmbedEntry({ ...BASE, hasNarration: true, providersPath: null });
    // Never inlines the manifest as a build-time JSON import.
    expect(withNarration).not.toContain("import _manifest");
    // Imports the hook (appended after the interaction primitives) and fetches
    // the manifest from its own relative location, so clip src values resolve
    // against ./narration/ at runtime.
    expect(withNarration).toContain(
      'import { ScenarioPlayer, DemoViewport, SCENAR_CLASS, Cursor, useStepInteractions, ViewportTransformLayer, VIEWPORT_TRANSFORM_IDENTITY, useNarrationManifest } from "@scenar/react";',
    );
    expect(withNarration).toContain('const _resolveManifestUrl = () => "./narration/manifest.json";');
    expect(withNarration).toContain(
      'const _manifest = useNarrationManifest("welcome-tour", _resolveManifestUrl);',
    );
    expect(withNarration).toContain("narrationManifest: _manifest,");
  });

  it("wraps in PreviewProviders only when a providers file exists", () => {
    const without = generateEmbedEntry({ ...BASE, hasNarration: false, providersPath: null });
    expect(without).not.toContain("_Providers");

    const withProviders = generateEmbedEntry({
      ...BASE,
      hasNarration: false,
      providersPath: "/proj/.scenar/providers.tsx",
    });
    expect(withProviders).toContain(
      'import { PreviewProviders as _Providers } from "/proj/.scenar/providers";',
    );
    expect(withProviders).toContain("<_Providers>");
    expect(withProviders).toContain("</_Providers>");
  });
});

describe("generateEmbedHtml", () => {
  it("references the entry as an external module script (CSP-safe, no inline code)", () => {
    const html = generateEmbedHtml("welcome-tour", "entry.tsx");
    expect(html).toContain('<script type="module" src="./entry.tsx"></script>');
    expect(html).toContain('<div id="root"></div>');
    // No inline executable script body — only the external src reference.
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>[^<]+<\/script>/);
  });

  it("escapes the title", () => {
    const html = generateEmbedHtml("a<b>&c", "entry.tsx");
    expect(html).toContain("<title>a&lt;b&gt;&amp;c</title>");
  });

  it("declares the dual color-scheme and a transparent canvas", () => {
    // The canvas contract: `light dark` keeps the embed's scheme matched to a
    // same-origin host (mismatch forces an opaque white iframe canvas), and
    // transparent html/body let the host page's background show through any
    // pixel the tour doesn't paint. See generateEmbedHtml's doc comment.
    const html = generateEmbedHtml("welcome-tour", "entry.tsx");
    expect(html).toContain('<meta name="color-scheme" content="light dark" />');
    expect(html).toContain("html, body { margin: 0; background: transparent; }");
    expect(html).not.toContain("light-dark(");
  });

  it("pre-paints the scheme-matched backdrop when staged, before any script runs", () => {
    // A staged embed trades the transparent canvas for the stage backdrop.
    // The static pre-paint prevents a backdrop flash at script load and must
    // key off the propagated color scheme, never a pinned one.
    const html = generateEmbedHtml("welcome-tour", "entry.tsx", true);
    expect(html).toContain("light-dark(");
    expect(html).toContain('<meta name="color-scheme" content="light dark" />');
    expect(html).not.toContain("colorScheme");
  });

  it("keys the pre-paint theme split through colors, never whole gradients", () => {
    // `light-dark()` is a <color>-only function. Wrapping a gradient in it is
    // invalid CSS that browsers drop silently — the exact defect the current
    // structure replaced. Every light-dark() in the pre-paint must contain
    // two hex colors and nothing else.
    const html = generateEmbedHtml("welcome-tour", "entry.tsx", true);
    const usages = [...html.matchAll(/light-dark\(([^)]*)\)/g)].map((m) => m[1]!);
    expect(usages.length).toBeGreaterThan(0);
    for (const args of usages) {
      expect(args.trim()).toMatch(/^#[0-9a-f]{6}, #[0-9a-f]{6}$/);
    }
  });
});

describe("stage backdrop drift-lock (pre-paint mirrors @scenar/react tokens)", () => {
  // The pre-paint duplicates the `--scenar-backdrop-*` tokens because the
  // token stylesheet is not loadable before the entry script runs. This suite
  // is the enforcement of the "keep the two in sync" contract: it reads the
  // actual tokens.css source from the workspace and fails when either the
  // palette or the mesh geometry drifts.
  // Locate @scenar/react's token source by walking up to the workspace root —
  // vitest runs with cwd at either the package dir or the repo root.
  const findTokensCss = (): string => {
    let dir = process.cwd();
    for (;;) {
      const candidate = join(dir, "packages/react/src/theme/tokens.css");
      if (existsSync(candidate)) return candidate;
      const parent = dirname(dir);
      if (parent === dir) {
        throw new Error("tokens.css not found — is the monorepo layout intact?");
      }
      dir = parent;
    }
  };
  const tokensCss = readFileSync(findTokensCss(), "utf-8");

  const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

  it("mirrors every backdrop color token, light and dark", () => {
    for (const { token, light, dark } of STAGE_BACKDROP_COLORS) {
      // Each token is declared exactly twice: `.scenar` (light) first,
      // `.scenar.dark` second.
      const declarations = [
        ...tokensCss.matchAll(new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`, "g")),
      ].map((m) => m[1]!.toLowerCase());
      expect(declarations, `${token} must be declared in both theme blocks`).toHaveLength(2);
      expect(declarations[0], `${token} light value drifted`).toBe(light);
      expect(declarations[1], `${token} dark value drifted`).toBe(dark);
    }
  });

  it("mirrors the mesh geometry", () => {
    const backdrop = tokensCss.match(/--scenar-backdrop:\s*([^;]+);/);
    expect(backdrop, "tokens.css must define --scenar-backdrop").not.toBeNull();
    expect(normalize(backdrop![1]!)).toBe(normalize(STAGE_BACKDROP_MESH.join(", ")));
  });

  it("emits the mirrored palette and geometry into the staged pre-paint", () => {
    const html = normalize(generateEmbedHtml("welcome-tour", "entry.tsx", true));
    for (const { token, light, dark } of STAGE_BACKDROP_COLORS) {
      expect(html).toContain(`${token}: light-dark(${light}, ${dark});`);
    }
    for (const layer of STAGE_BACKDROP_MESH) {
      expect(html).toContain(normalize(layer));
    }
  });
});
