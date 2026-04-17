// @scenar/sdk — public API
// Typed authoring surface for Scenar scenarios.

// TS-first builder
export { createScenario } from "./author/createScenario.js";
export type {
  AuthoredScenario,
  AuthoredStepData,
  ViewRegistry,
  ViewportConfig,
  StepInput,
  ScenarioInput,
  PropsOf,
} from "./author/types.js";

// Proto adapter
export { loadScenarioFromProto } from "./proto/load-scenario.js";
export type { LoadScenarioOptions } from "./proto/load-scenario.js";
export { InvalidScenarioError } from "./proto/errors.js";

// Proto structural types (for consumers building custom loaders)
export type {
  ProtoScenario,
  ProtoScenarioSpec,
  ProtoStep,
  ProtoStepAction,
  ProtoStepActionConfig,
  ProtoViewportConfig,
} from "./proto/proto-types.js";
