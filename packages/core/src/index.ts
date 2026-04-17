// @scenar/core — public API
// Pure TypeScript types, timing, and utilities for scenario playback.

// Scenario types
export type { ScenarioStep } from "./scenario/types.js";
export type {
  ActionType,
  StepAction,
  UseStepInteractionsOptions,
} from "./scenario/step-action.js";

// Narration types
export type { NarrationEntry, NarrationManifest } from "./narration/types.js";

// Viewport types
export type { ViewportTransform } from "./viewport/transform.js";
export { VIEWPORT_TRANSFORM_IDENTITY } from "./viewport/transform.js";

// Cursor types
export type { Position } from "./cursor/compute-position.js";
export { computeCursorPosition } from "./cursor/compute-position.js";

// Timeline
export type { StepTimeline } from "./timeline/compute-step-timeline.js";
export { computeStepTimeline } from "./timeline/compute-step-timeline.js";
export { deriveStepFromTime } from "./timeline/derive-step.js";
export { getStepDurationMs } from "./timeline/step-duration.js";

// Timing constants
export {
  CLICK_DELAY_MS,
  TYPE_CHAR_DELAY_MS,
  HOVER_HOLD_MS,
  DRAG_SETTLE_MS,
  VIEWPORT_SETTLE_MS,
} from "./timing/constants.js";

// DOM scroll utilities
export {
  findScrollParent,
  scrollTargetIntoView,
  scrollTargetIntoViewInstant,
} from "./dom/scroll.js";

// Data-attribute targeting contract
export {
  CURSOR_TARGET_ATTRIBUTE,
  SCROLL_TARGET_ATTRIBUTE,
  HOVER_STATE_ATTRIBUTE,
  DRAG_STATE_ATTRIBUTE,
  cursorTargetSelector,
  scrollTargetSelector,
} from "./targeting/data-attributes.js";
