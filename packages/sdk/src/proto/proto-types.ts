/**
 * Structural types mirroring the proto-generated TypeScript stubs.
 *
 * The SDK accepts values matching these shapes via structural subtyping.
 * This avoids a hard dependency on the generated stubs — consumers
 * pass proto-generated objects directly and TypeScript validates
 * compatibility structurally.
 *
 * Field names match protoc-gen-es v2 output (camelCase).
 */

/** Mirrors generated `ActionType` enum values. */
export const PROTO_ACTION_TYPE = {
  unspecified: 0,
  set_cursor: 1,
  clear_cursor: 2,
  click: 3,
  type: 4,
  hover: 5,
  drag: 6,
  scroll_to: 7,
  viewport_transition: 8,
} as const;

export type ProtoActionTypeValue = (typeof PROTO_ACTION_TYPE)[keyof typeof PROTO_ACTION_TYPE];

/** Structural shape of a proto `ViewportConfig` message. */
export interface ProtoViewportConfig {
  readonly width: number;
  readonly height: number;
}

/** Structural shape of a proto `TypeConfig` message. */
export interface ProtoTypeConfig {
  readonly text: string;
  readonly typeDelayMs: number;
}

/** Structural shape of a proto `HoverConfig` message. */
export interface ProtoHoverConfig {
  readonly hoverDurationMs: number;
}

/** Structural shape of a proto `DragConfig` message. */
export interface ProtoDragConfig {
  readonly dragTarget: string;
}

/** Structural shape of a proto `ViewportTransitionConfig` message. */
export interface ProtoViewportTransitionConfig {
  readonly viewportZoom: number;
  readonly viewportReset: boolean;
}

/**
 * Structural shape of the proto `StepAction.config` oneof.
 * Matches protoc-gen-es v2's discriminated union output.
 */
export type ProtoStepActionConfig =
  | { case: "clickConfig"; value: object }
  | { case: "typeConfig"; value: ProtoTypeConfig }
  | { case: "hoverConfig"; value: ProtoHoverConfig }
  | { case: "dragConfig"; value: ProtoDragConfig }
  | { case: "scrollToConfig"; value: object }
  | { case: "viewportTransitionConfig"; value: ProtoViewportTransitionConfig }
  | { case: undefined; value?: undefined };

/** Structural shape of a proto `StepAction` message. */
export interface ProtoStepAction {
  readonly atPercent: number;
  readonly type: number;
  readonly target: string;
  readonly config: ProtoStepActionConfig;
}

/**
 * Structural shape of a proto `Step` message.
 * `props` is `JsonObject` (protoc-gen-es v2 auto-converts `Struct`).
 */
export interface ProtoStep {
  readonly view: string;
  readonly delayMs: number;
  readonly caption: string;
  readonly narrationText: string;
  readonly props?: Record<string, unknown>;
  readonly interactions: readonly ProtoStepAction[];
}

/** Structural shape of the proto `Scenario` message. */
export interface ProtoScenario {
  readonly viewport?: ProtoViewportConfig;
  readonly steps: readonly ProtoStep[];
}
