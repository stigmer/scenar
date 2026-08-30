// @scenar/remotion — public API
// Remotion integration for rendering Scenar scenarios as videos.

// Re-export core types for consumer convenience
export type {
  ScenarioBundle,
  NarrationManifest,
  ScenarioStep,
  StepTimeline,
  TitleCard,
  TitleCards,
  StepCard,
  AppliedTitleCards,
} from "@scenar/core";
// Card synthesis is re-exported so the generated render entry — which
// already imports this package — never needs @scenar/core as a direct
// dependency of the scenario project.
export { applyTitleCards } from "@scenar/core";

// Composition
export { ScenarioComposition } from "./ScenarioComposition.js";

// Timeline
export type { ScenarioTimeline, AudioClip } from "./useScenarioTimeline.js";
export {
  useScenarioTimeline,
  calculateScenarioTimeline,
  msToFrames,
} from "./useScenarioTimeline.js";
