// @scenar/react — public API
// React components and hooks for scenario playback.

// Re-export core types for consumer convenience
export type {
  ScenarioStep,
  ScenarioBundle,
  ActionType,
  StepAction,
  UseStepInteractionsOptions,
  NarrationEntry,
  NarrationManifest,
  Soundtrack,
  TitleCard,
  TitleCards,
  StepCard,
  AppliedTitleCards,
  SfxEvent,
  SfxSound,
  ViewportTransform,
  Position,
  StepTimeline,
} from "@scenar/core";
export {
  VIEWPORT_TRANSFORM_IDENTITY,
  // Card synthesis is re-exported so bundle assemblers that already
  // depend on this package (the generated pack entry, direct
  // integrators) never need @scenar/core as a direct dependency.
  applyTitleCards,
  computeStepTimeline,
  deriveStepFromTime,
  getStepDurationMs,
  CLICK_DELAY_MS,
  TYPE_CHAR_DELAY_MS,
  HOVER_HOLD_MS,
  DRAG_SETTLE_MS,
  VIEWPORT_SETTLE_MS,
  CURSOR_TARGET_ATTRIBUTE,
  SCROLL_TARGET_ATTRIBUTE,
} from "@scenar/core";

// Time source
export type { TimeSourceValue } from "./time/TimeSource.js";
export { TimeSourceProvider, useTimeSource } from "./time/TimeSource.js";

// Video export
export { VideoExportProvider, useVideoExport } from "./video/VideoExportContext.js";

// Still capture (the tree behind `scenar shoot` and the packed entry's ?shot mode)
export { ScenarioCaptureMount, SHOT_FRAME_SELECTOR } from "./capture/ScenarioCaptureMount.js";
export type {
  ScenarioCaptureDriver,
  ScenarioCaptureMountProps,
} from "./capture/ScenarioCaptureMount.js";

// Playback coordination
export { register as registerPlayer, notifyPlaying } from "./playback/PlaybackCoordinator.js";

// Narration
export {
  useNarrationManifest,
  resolveNarrationManifestUrls,
} from "./narration/useNarrationManifest.js";
export { useNarrationPlayback } from "./narration/useNarrationPlayback.js";

// Soundtrack (music + derived SFX)
export { useSoundtrackPlayback } from "./soundtrack/useSoundtrackPlayback.js";
export type { SoundtrackSources } from "./soundtrack/useSoundtrackPlayback.js";

// Cursor
export { Cursor } from "./cursor/Cursor.js";

// Viewport
export { ViewportTransformLayer } from "./viewport/ViewportTransformLayer.js";
export { DemoViewport } from "./viewport/DemoViewport.js";
export { ScenarioStage } from "./stage/ScenarioStage.js";

// Player
export { ScenarioPlayer } from "./player/ScenarioPlayer.js";
export { PlaybackBurst, ScenarioAudioNotice } from "./player/PlaybackFeedback.js";
export { ScenarioControls } from "./player/ScenarioControls.js";
export { SpeedMenu } from "./player/SpeedMenu.js";
export { useStepProgression } from "./player/useStepProgression.js";
export { usePlaybackProgress } from "./player/usePlaybackProgress.js";

// Step interactions
export { useStepInteractions } from "./interactions/useStepInteractions.js";

// Embed bridge (cross-origin iframe postMessage protocol)
// The protocol + host controller live in @scenar/core; re-exported here so
// existing `@scenar/react` consumers keep their imports unchanged.
export { useScenarEmbedBridge } from "./embed/useScenarEmbedBridge.js";
export type {
  ScenarEmbedControls,
  UseScenarEmbedBridgeOptions,
} from "./embed/useScenarEmbedBridge.js";
export {
  SCENAR_EMBED_SOURCE,
  SCENAR_EMBED_PROTOCOL_VERSION,
  frameEmbedEvent,
  frameEmbedCommand,
  parseEmbedCommand,
  parseEmbedEvent,
} from "@scenar/core";
export type {
  ScenarEmbedEvent,
  ScenarEmbedCommand,
  ScenarEmbedEventMessage,
  ScenarEmbedCommandMessage,
} from "@scenar/core";

// Theme
export { SCENAR_CLASS, getEmbedColorMode } from "./theme/index.js";
export type { ColorMode } from "./theme/index.js";

// Shells
export {
  BrowserView,
  TerminalView,
  CodeEditorView,
  MobileView,
  ChatView,
  ChatBubble,
  TypingIndicator,
  SlideView,
  DashboardView,
  APIClientView,
  DesktopView,
  SHELL_HEIGHT_DEFAULT,
  SHELL_HEIGHT_MIN,
  BROWSER_SHELL_HEIGHT_DEFAULT,
  MOBILE_SHELL_HEIGHT_DEFAULT,
  SLIDE_SHELL_HEIGHT_DEFAULT,
} from "./shells/index.js";
export type {
  BrowserViewProps,
  TerminalLine,
  TerminalViewProps,
  FileTreeEntry,
  CodeEditorViewProps,
  MobileViewProps,
  ChatViewProps,
  ChatBubbleProps,
  TypingIndicatorProps,
  SlideViewProps,
  SidebarItem,
  DashboardViewProps,
  APIClientViewProps,
  HttpMethod,
  DesktopViewProps,
} from "./shells/index.js";

// Highlights
export { PulseHighlight } from "./highlights/index.js";

// Pages — primitives & templates for realistic BrowserView content
export {
  // Primitives
  PageLayout,
  AppBar,
  SideNav,
  FormCard,
  DataTable,
  SettingsForm,
  Breadcrumb,
  StatusBadge,
  // Templates
  LoginCardPage,
  SettingsFormPage,
  AdminListPage,
  DashboardPage,
} from "./pages/index.js";
export type {
  // Primitive types
  PageLayoutProps,
  AppBarProps,
  NavLink,
  SideNavProps,
  SideNavItem,
  FormCardProps,
  FormField,
  DataTableProps,
  DataTableColumn,
  DataTableRow,
  SettingsFormProps,
  SettingsField,
  BreadcrumbProps,
  StatusBadgeProps,
  BadgeVariant,
  // Template types
  LoginCardPageProps,
  SettingsFormPageProps,
  AdminListPageProps,
  DashboardPageProps,
} from "./pages/index.js";
