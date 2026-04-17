import type { ScenarioStep, StepAction } from "@scenar/core";

/**
 * A view registry maps opaque view identifiers (strings) to
 * "anything that accepts props." The SDK is framework-agnostic:
 * values do NOT have to be React components — any callable with
 * a single-parameter signature satisfies the constraint.
 *
 * The player's render prop is what actually calls the component.
 * The SDK only uses the registry for type-level prop inference.
 */
export type ViewRegistry = Record<string, (props: never) => unknown>;

/**
 * Extract the props type from a view entry in the registry.
 * Falls back to `Record<string, never>` for entries that accept
 * no parameters (zero-prop components).
 */
export type PropsOf<V> = V extends (props: infer P) => unknown ? P : Record<string, never>;

/** Viewport dimensions for deterministic rendering. */
export interface ViewportConfig {
  readonly width: number;
  readonly height: number;
}

/**
 * The data payload on each `ScenarioStep` produced by `createScenario`.
 * This is a discriminated union keyed on `view`, where `props` is
 * statically typed against the component registered under that view name.
 */
export type AuthoredStepData<Views extends ViewRegistry> = {
  [K in keyof Views & string]: {
    readonly view: K;
    readonly props: PropsOf<Views[K]>;
  };
}[keyof Views & string];

/**
 * A single step as the author writes it in `createScenario({ steps: [...] })`.
 *
 * The generic parameter distributes over view keys so TypeScript
 * narrows `props` based on the `view` discriminant.
 */
export type StepInput<Views extends ViewRegistry> = {
  [K in keyof Views & string]: {
    readonly view: K;
    readonly delayMs: number;
    readonly caption?: string;
    readonly narrationText?: string;
    readonly props: PropsOf<Views[K]>;
    readonly interactions?: readonly StepAction[];
  };
}[keyof Views & string];

/**
 * Input to `createScenario()`.
 */
export interface ScenarioInput<Views extends ViewRegistry> {
  /** Canonical viewport dimensions. Optional — the engine has defaults. */
  readonly viewport?: ViewportConfig;
  /** Map of view identifiers to components / callables. */
  readonly views: Views;
  /** Ordered sequence of steps. Must contain at least one entry. */
  readonly steps: readonly StepInput<Views>[];
}

/**
 * The output of `createScenario()` — ready to feed into
 * `<ScenarioPlayer>` with a trivial render prop.
 */
export interface AuthoredScenario<Views extends ViewRegistry> {
  readonly viewport: ViewportConfig | undefined;
  readonly views: Views;
  readonly steps: readonly ScenarioStep<AuthoredStepData<Views>>[];
}
