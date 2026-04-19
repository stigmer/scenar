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
  ViewportTransform,
  Position,
  StepTimeline,
} from "@scenar/core";
export {
  VIEWPORT_TRANSFORM_IDENTITY,
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

// Playback coordination
export { register as registerPlayer, notifyPlaying } from "./playback/PlaybackCoordinator.js";

// Narration
export { useNarrationManifest } from "./narration/useNarrationManifest.js";
export { useNarrationPlayback } from "./narration/useNarrationPlayback.js";

// Cursor
export { Cursor } from "./cursor/Cursor.js";

// Viewport
export { ViewportTransformLayer } from "./viewport/ViewportTransformLayer.js";
export { DemoViewport } from "./viewport/DemoViewport.js";

// Player
export { ScenarioPlayer } from "./player/ScenarioPlayer.js";
export { ScenarioPoster, ScenarioPauseOverlay } from "./player/ScenarioPoster.js";
export { ScenarioControls } from "./player/ScenarioControls.js";
export { SpeedMenu } from "./player/SpeedMenu.js";
export { useStepProgression } from "./player/useStepProgression.js";
export { usePlaybackProgress } from "./player/usePlaybackProgress.js";

// Step interactions
export { useStepInteractions } from "./interactions/useStepInteractions.js";

// Theme
export { SCENAR_CLASS } from "./theme/index.js";

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
