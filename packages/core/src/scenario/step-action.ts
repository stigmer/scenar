import type { NarrationManifest } from "../narration/types.js";
import type { ViewportTransform } from "../viewport/transform.js";
import type { ScenarioStep } from "./types.js";

/**
 * The set of interaction types the engine understands.
 *
 * Values match the proto `ActionType` enum names (`ai.scenar.scenario.v1`)
 * so that proto ↔ engine mapping is a direct string copy.
 */
export type ActionType =
  | "scroll_to"
  | "set_cursor"
  | "clear_cursor"
  | "click"
  | "type"
  | "hover"
  | "drag"
  | "viewport_transition";

/** A single timed interaction within a step. */
export interface StepAction {
  /**
   * When to fire, as a fraction of the step's narration duration
   * (0.0 = step start, 1.0 = narration end). The hook reads the
   * narration manifest to compute the real millisecond time.
   *
   * When no narration is available (muted / no manifest), the next
   * step's `delayMs` is used as the fallback step duration.
   */
  readonly atPercent: number;
  /** Action type. */
  readonly type: ActionType;
  /**
   * Target element identifier.
   * - For `scroll_to`: matches `[data-scroll-target="<target>"]`
   * - For `set_cursor` / `click` / `type` / `hover`: matches `[data-cursor-target="<target>"]`
   * - For `drag`: matches `[data-cursor-target="<target>"]` (drag source)
   */
  readonly target?: string;
  /**
   * Drag destination element identifier. Only used by `drag` actions.
   * Matches `[data-cursor-target="<dragTarget>"]`.
   */
  readonly dragTarget?: string;
  /** Text to type character-by-character. Only used by `type` actions. */
  readonly text?: string;
  /**
   * Milliseconds between characters for `type` actions.
   * Defaults to {@link TYPE_CHAR_DELAY_MS} (50 ms).
   */
  readonly typeDelay?: number;
  /**
   * Milliseconds to hold the cursor over the target during a `hover`
   * action, between enter-event dispatch and leave-event dispatch.
   * Defaults to {@link HOVER_HOLD_MS} (1500 ms).
   */
  readonly hoverDuration?: number;
  /**
   * Zoom scale factor for `viewport_transition` actions.
   * Values > 1 zoom in, < 1 zoom out. Defaults to 1.5.
   * Ignored when {@link viewportReset} is `true`.
   */
  readonly viewportZoom?: number;
  /**
   * When `true`, a `viewport_transition` action resets the viewport
   * to the identity transform (scale 1, no translation). `target`
   * and `viewportZoom` are ignored.
   */
  readonly viewportReset?: boolean;
}

/** Configuration for the useStepInteractions hook. */
export interface UseStepInteractionsOptions<T> {
  /** Current active step index from ScenarioPlayer. */
  stepIndex: number;
  /** Narration manifest for duration lookup. */
  narrationManifest: NarrationManifest | undefined;
  /** Container ref for DOM queries. */
  containerRef: { current: HTMLElement | null };
  /** Callback to change the cursor target mid-step. */
  setCursorTarget: (target: string | undefined) => void;
  /**
   * The full steps array. Interactions are read from each step's
   * `interactions` field. Step `delayMs` is used as fallback duration
   * when narration is unavailable.
   */
  steps: readonly ScenarioStep<T>[];
  /**
   * Playback speed multiplier (default 1). Browser-path timeouts are
   * divided by this value so interactions fire proportionally earlier
   * at higher speeds.
   */
  playbackRate?: number;
  /**
   * Optional callback to control the Cursor's click ripple. The
   * `hover` action calls `setShowRipple(false)` before moving the
   * cursor and `setShowRipple(true)` after hover leave events fire.
   */
  setShowRipple?: (show: boolean) => void;
  /**
   * Optional callback to control the Cursor's drag visual. The
   * `drag` action calls `setDragging(true)` after pressing at the
   * source and `setDragging(false)` after releasing at the destination.
   */
  setDragging?: (dragging: boolean) => void;
  /**
   * Optional callback to apply a viewport transform (zoom/pan). The
   * `viewport_transition` action computes scale and translate values
   * needed to center the target element and calls this callback.
   */
  setViewportTransform?: (transform: ViewportTransform) => void;
}
