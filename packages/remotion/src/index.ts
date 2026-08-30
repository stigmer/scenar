// @scenar/remotion — public API
// Remotion integration for rendering Scenar scenarios as videos.

// Re-export core types for consumer convenience
export type { ScenarioBundle, NarrationManifest, ScenarioStep, StepTimeline } from "@scenar/core";

// Composition
export { ScenarioComposition } from "./ScenarioComposition.js";

// Timeline
export type { ScenarioTimeline, AudioClip } from "./useScenarioTimeline.js";
export {
  useScenarioTimeline,
  calculateScenarioTimeline,
  msToFrames,
} from "./useScenarioTimeline.js";
