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
    expect(src).toContain('import { ScenarioPlayer, DemoViewport, SCENAR_CLASS } from "@scenar/react";');
    expect(src).toContain('import { renderStep } from "/proj/scenarios/welcome-tour/index";');
    expect(src).toContain("<ScenarioPlayer bundle={_bundle} embed>");
    expect(src).toContain("renderStep(data, stepIndex)");
    expect(src).toContain('getElementById("root")');
  });

  it("imports the @scenar/react theme + styles so the bundle is self-contained", () => {
    const src = generateEmbedEntry({ ...BASE, hasNarration: false, providersPath: null });
    expect(src).toContain('import "@scenar/react/theme.css";');
    expect(src).toContain('import "@scenar/react/styles.css";');
  });

  it("scopes the tree with SCENAR_CLASS + DemoViewport sizing", () => {
    const src = generateEmbedEntry({ ...BASE, hasNarration: false, providersPath: null });
    expect(src).toContain("className={SCENAR_CLASS}");
    expect(src).toContain("canonicalWidth={896}");
    expect(src).toContain("shellHeight={480}");
  });

  it("fetches the narration manifest at runtime only when present", () => {
    const without = generateEmbedEntry({ ...BASE, hasNarration: false, providersPath: null });
    expect(without).toContain("narrationManifest: undefined,");
    expect(without).not.toContain("useNarrationManifest");
    expect(without).not.toContain("import _manifest");

    const withNarration = generateEmbedEntry({ ...BASE, hasNarration: true, providersPath: null });
    // Never inlines the manifest as a build-time JSON import.
    expect(withNarration).not.toContain("import _manifest");
    // Imports the hook and fetches the manifest from its own relative location,
    // so clip src values resolve against ./narration/ at runtime.
    expect(withNarration).toContain(
      'import { ScenarioPlayer, DemoViewport, SCENAR_CLASS, useNarrationManifest } from "@scenar/react";',
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
});
