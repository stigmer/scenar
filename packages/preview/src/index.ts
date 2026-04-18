// @scenar/preview — public API
// Scan React projects, generate view registries, and provide runtime preview support.

// Scanner
export { scanProject } from "./scanner/scan.js";
export type { ScanResult, DiscoveredComponent, SkippedComponent, SkipReason } from "./scanner/types.js";

// Generator
export { generate } from "./generator/generate.js";
export type { GenerateOptions, GenerateResult } from "./generator/types.js";

// Config
export { defineConfig } from "./config.js";
export type { PreviewConfig, FrameworkType } from "./config.js";
