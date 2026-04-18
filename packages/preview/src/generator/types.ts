/** Options for the code generator. */
export interface GenerateOptions {
  /** Absolute path to the project root. */
  readonly projectRoot: string;
  /** Output directory for generated files (relative to projectRoot). Defaults to ".scenar". */
  readonly outputDir?: string;
  /**
   * When true, behaves like `scenar preview init`:
   * creates all files including user-owned ones.
   * When false (sync mode), only overwrites scanner-owned files.
   */
  readonly isInit?: boolean;
  /** Force-regenerate providers.tsx even in init mode. */
  readonly resetProviders?: boolean;
}

/** Result of code generation. */
export interface GenerateResult {
  /** Files that were written. */
  readonly written: readonly string[];
  /** Files that were skipped (already exist and are user-owned). */
  readonly preserved: readonly string[];
}
