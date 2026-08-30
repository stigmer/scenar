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
