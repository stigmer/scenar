/** Supported framework types for entry point detection. */
export type FrameworkType = "nextjs" | "vite" | "cra" | "remix" | "unknown";

/** Configuration for `scenar preview init` / `scenar preview sync`. */
export interface PreviewConfig {
  /** Directories to scan for React components (relative to project root). */
  readonly sourceRoots: readonly string[];
  /** Glob patterns to exclude from scanning. */
  readonly exclude: readonly string[];
  /** Detected or declared framework. */
  readonly framework: FrameworkType;
  /** App entry point for provider detection (relative to project root). */
  readonly entryPoint?: string;
}

const DEFAULT_EXCLUDES: readonly string[] = [
  "**/*.test.*",
  "**/*.spec.*",
  "**/*.stories.*",
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/__tests__/**",
  "**/__mocks__/**",
];

/**
 * Helper to create a typed preview config.
 * Used in the generated `scenar.config.ts`.
 */
export function defineConfig(config: Partial<PreviewConfig>): PreviewConfig {
  return {
    sourceRoots: config.sourceRoots ?? ["src"],
    exclude: config.exclude ?? DEFAULT_EXCLUDES,
    framework: config.framework ?? "unknown",
    entryPoint: config.entryPoint,
  };
}
