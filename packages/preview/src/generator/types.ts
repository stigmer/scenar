/** Options for the code generator. */
export interface GenerateOptions {
  /** Absolute path to the project that was scanned (source). */
  readonly sourceRoot: string;
  /** Absolute path to the output directory for generated files. */
  readonly outputDir: string;
  /**
   * When true, this is a first run: creates all files including user-owned
   * ones. When false (a re-run), only overwrites scanner-owned files.
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
