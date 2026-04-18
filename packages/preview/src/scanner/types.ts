/** Reason a component was excluded from the generated view registry. */
export type SkipReason =
  | "server-component"
  | "server-only-import"
  | "dynamic-import"
  | "higher-order-component"
  | "hook"
  | "no-jsx-return"
  | "no-default-or-named-export";

/** A single prop extracted from a component's props interface. */
export interface PropInfo {
  readonly name: string;
  /** TypeScript type as a string (e.g. "string", "Order[]", "() => void"). */
  readonly type: string;
  readonly required: boolean;
}

/** File-level category based on directory convention. */
export type ComponentCategory = "page" | "layout" | "component" | "primitive";

/** A React component the scanner successfully identified. */
export interface DiscoveredComponent {
  /** PascalCase component name. */
  readonly name: string;
  /** Import path relative to the project root (e.g. "../src/pages/Dashboard"). */
  readonly importPath: string;
  /** Absolute path of the source file. */
  readonly filePath: string;
  /** Whether this is a default or named export. */
  readonly exportType: "named" | "default";
  /** Extracted prop information. */
  readonly props: readonly PropInfo[];
  /** Whether the component calls useContext(). */
  readonly usesContext: boolean;
  /** Heuristic category. */
  readonly category: ComponentCategory;
}

/** A component the scanner found but excluded. */
export interface SkippedComponent {
  readonly name: string;
  readonly filePath: string;
  readonly reason: SkipReason;
}

/** Full result from scanning a project. */
export interface ScanResult {
  readonly discovered: readonly DiscoveredComponent[];
  readonly skipped: readonly SkippedComponent[];
  /** Detected framework type. */
  readonly framework: import("../config.js").FrameworkType;
  /** Detected app entry point (if any). */
  readonly entryPoint: string | undefined;
  /** Provider imports detected in the entry point. */
  readonly detectedProviders: readonly string[];
}
