import { describe, it, expect } from "vitest";
import { generateRemotionEntry } from "../render/generate-entry.js";

const BASE = {
  scenarioDir: "/proj/scenarios/welcome-tour",
  renderFilePath: "/proj/scenarios/welcome-tour/index.tsx",
  scenarioId: "welcome-tour",
  hasNarration: false,
  hasPresenter: false,
  providersPath: null,
  fps: 30,
  width: 1920,
  height: 1080,
  compositionId: "welcome-tour",
} as const;

describe("generateRemotionEntry captions", () => {
  it("emits a plain ScenarioComposition without the flag — prior output unchanged", () => {
    const src = generateRemotionEntry({ ...BASE, captions: false });
    expect(src).toContain("<ScenarioComposition bundle={_bundle}>");
    expect(src).not.toContain("captions");
  });

  it("bakes the captions prop into the composition when the flag is set", () => {
    const src = generateRemotionEntry({ ...BASE, captions: true });
    expect(src).toContain("<ScenarioComposition bundle={_bundle} captions>");
  });

  it("bakes the captions prop inside the providers wrapper too", () => {
    const src = generateRemotionEntry({
      ...BASE,
      providersPath: "/proj/.scenar/providers.tsx",
      captions: true,
    });
    expect(src).toContain("<_Providers>");
    expect(src).toContain("<ScenarioComposition bundle={_bundle} captions>");
  });
});

describe("generateRemotionEntry providers layout", () => {
  it("sandwiches the providers between two absolute fills (scenar#33)", () => {
    const src = generateRemotionEntry({
      ...BASE,
      providersPath: "/proj/.scenar/providers.tsx",
      captions: false,
    });
    // ScenarioComposition sizes through a CSS height chain; a provider
    // wrapper with auto height must not be able to collapse it. The inner
    // AbsoluteFill restores the chain regardless of what providers render.
    const providersOpen = src.indexOf("<_Providers>");
    const innerFill = src.indexOf("<AbsoluteFill>", providersOpen);
    const composition = src.indexOf("<ScenarioComposition", providersOpen);
    expect(providersOpen).toBeGreaterThan(-1);
    expect(innerFill).toBeGreaterThan(providersOpen);
    expect(composition).toBeGreaterThan(innerFill);
  });

  it("keeps the provider-less tree at a single fill — prior output unchanged", () => {
    const src = generateRemotionEntry({ ...BASE, captions: false });
    expect(src).not.toContain("<AbsoluteFill>\n");
    expect(src.match(/<AbsoluteFill/g)).toHaveLength(1);
  });
});

describe("generateRemotionEntry soundtrack", () => {
  it("discovers the soundtrack from the steps module at module-eval time", () => {
    const src = generateRemotionEntry({ ...BASE, captions: false });
    // The runtime mirror of the CLI's findAuthoredSoundtrack: scenario-shaped
    // export first, then the `soundtrack` named export.
    expect(src).toContain("function _findSoundtrack(");
    expect(src).toContain(
      "const _soundtrack: any = _findSoundtrack(_stepsModule as unknown as Record<string, unknown>);",
    );
  });

  it("carries the discovered soundtrack on the bundle", () => {
    const src = generateRemotionEntry({ ...BASE, captions: false });
    expect(src).toContain("soundtrack: _soundtrack,");
  });
});

describe("generateRemotionEntry title cards", () => {
  it("discovers title cards from the steps module at module-eval time", () => {
    const src = generateRemotionEntry({ ...BASE, captions: false });
    // The runtime mirror of the CLI's findAuthoredTitleCards: scenario-shaped
    // export first, then the `titleCards` named export.
    expect(src).toContain("function _findTitleCards(");
    expect(src).toContain(
      "const _titleCards: any = _findTitleCards(_stepsModule as unknown as Record<string, unknown>);",
    );
  });

  it("synthesizes card steps before the timeline calculation", () => {
    const src = generateRemotionEntry({ ...BASE, captions: false });
    // Bundle assembly is THE one card-synthesis point; running it before
    // calculateScenarioTimeline is what makes an intro/outro lengthen
    // durationInFrames exactly like an authored step.
    expect(src).toContain(
      'import { ScenarioComposition, applyTitleCards, calculateScenarioTimeline } from "@scenar/remotion";',
    );
    expect(src).toContain("const _applied = applyTitleCards(_steps, _manifest, _titleCards, _presenterManifest);");
    expect(src.indexOf("const _applied = applyTitleCards(")).toBeLessThan(
      src.indexOf("calculateScenarioTimeline("),
    );
    expect(src).toContain("steps: _applied.steps as any,");
    expect(src).toContain("narrationManifest: _applied.narrationManifest,");
  });
});

describe("generateRemotionEntry presenter", () => {
  it("imports the presenter manifest and pads it through card synthesis", () => {
    const src = generateRemotionEntry({ ...BASE, hasPresenter: true, captions: false });
    expect(src).toContain(
      'import _presenterManifest from "/proj/scenarios/welcome-tour/presenter/manifest.json";',
    );
    expect(src).toContain(
      "const _applied = applyTitleCards(_steps, _manifest, _titleCards, _presenterManifest);",
    );
    expect(src).toContain("presenterManifest: _applied.presenterManifest,");
  });

  it("declares an undefined presenter manifest when the scenario has none", () => {
    const src = generateRemotionEntry({ ...BASE, captions: false });
    expect(src).toContain("const _presenterManifest = undefined;");
    expect(src).not.toContain("import _presenterManifest");
  });
});
