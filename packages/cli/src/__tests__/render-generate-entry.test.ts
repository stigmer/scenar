import { describe, it, expect } from "vitest";
import { generateRemotionEntry } from "../render/generate-entry.js";

const BASE = {
  scenarioDir: "/proj/scenarios/welcome-tour",
  renderFilePath: "/proj/scenarios/welcome-tour/index.tsx",
  scenarioId: "welcome-tour",
  hasNarration: false,
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
