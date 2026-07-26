import { describe, it, expect } from "vitest";
import {
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
  });
});
