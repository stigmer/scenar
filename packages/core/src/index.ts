// @scenar/core — public API
// Pure TypeScript types, timing, and utilities for scenario playback.

// Scenario types
export type { ScenarioStep } from "./scenario/types.js";
export type { ScenarioBundle } from "./scenario/bundle.js";
export type {
  ActionType,
  StepAction,
  UseStepInteractionsOptions,
} from "./scenario/step-action.js";

// Soundtrack
export type { Soundtrack } from "./scenario/soundtrack.js";
export {
  MUSIC_VOLUME_DEFAULT,
  DUCKING_VOLUME_DEFAULT,
} from "./scenario/soundtrack.js";

// Title cards
export type { TitleCard, TitleCards, StepCard } from "./scenario/title-cards.js";
export { TITLE_CARD_DURATION_DEFAULT_MS } from "./scenario/title-cards.js";
export type { AppliedTitleCards } from "./scenario/apply-title-cards.js";
export { applyTitleCards } from "./scenario/apply-title-cards.js";

// Narration types
export type { NarrationEntry, NarrationManifest } from "./narration/types.js";

// Viewport types
export type { ViewportTransform, ViewportCameraMove } from "./viewport/transform.js";
export {
  VIEWPORT_TRANSFORM_IDENTITY,
  VIEWPORT_CAMERA_AT_REST,
  cameraEase,
  interpolateViewportTransform,
} from "./viewport/transform.js";

// Cursor types
export type { Position } from "./cursor/compute-position.js";
export { computeCursorPosition } from "./cursor/compute-position.js";

// Timeline
export type { StepTimeline } from "./timeline/compute-step-timeline.js";
export { FINAL_DWELL_MS, computeStepTimeline } from "./timeline/compute-step-timeline.js";
export { deriveStepFromTime } from "./timeline/derive-step.js";
export { getStepDurationMs } from "./timeline/step-duration.js";
export type { ActionEvent, ActionEventKind } from "./timeline/derive-action-events.js";
export { deriveActionEvents } from "./timeline/derive-action-events.js";
export type { SfxEvent, SfxSound } from "./timeline/derive-sfx-timeline.js";
export { deriveSfxTimeline } from "./timeline/derive-sfx-timeline.js";
export type { DuckingWindow, MusicEnvelope } from "./timeline/music-envelope.js";
export {
  MUSIC_FADE_IN_MS,
  MUSIC_FADE_OUT_MS,
  DUCKING_RAMP_MS,
  computeMusicEnvelope,
  musicGainAt,
} from "./timeline/music-envelope.js";
export type { ScenarioShot } from "./timeline/collect-shots.js";
export {
  SHOT_NAME_PATTERN,
  collectScenarioShots,
  collectShotNames,
} from "./timeline/collect-shots.js";

// Timing constants
export {
  CLICK_DELAY_MS,
  TYPE_CHAR_DELAY_MS,
  HOVER_HOLD_MS,
  DRAG_SETTLE_MS,
  CAMERA_TRANSITION_MS,
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

// Embed postMessage protocol (v1) — the cross-origin iframe wire contract
export {
  SCENAR_EMBED_SOURCE,
  SCENAR_EMBED_PROTOCOL_VERSION,
  frameEmbedEvent,
  frameEmbedCommand,
  parseEmbedCommand,
  parseEmbedEvent,
} from "./embed/protocol.js";
export type {
  ScenarEmbedEvent,
  ScenarEmbedCommand,
  ScenarEmbedEventMessage,
  ScenarEmbedCommandMessage,
  ScenarEmbedViewport,
} from "./embed/protocol.js";

// Embed host controller — framework-free driver for an embedded player
export { createEmbedHostController } from "./embed/host-controller.js";
export type {
  ScenarEmbedHostController,
  ScenarEmbedHostTarget,
  ScenarEmbedHostOptions,
} from "./embed/host-controller.js";
