/**
 * The programmatic API of the Scenar CLI — the same orchestration the commands
 * run, exposed as plain functions so other tools (notably @scenar/mcp-server)
 * can drive Scenar without shelling out. Each `run*` performs one operation and
 * returns a structured result; none touch process.exit or the process streams
 * (they accept an optional `onLog` for progress).
 */

// Pack
export { runPack } from "./pack/run-pack.js";
export type { RunPackOptions, PackResult } from "./pack/run-pack.js";
export type { PackManifest } from "./pack/pack-manifest.js";

// Narrate
export { runNarrate } from "./narrate/run-narrate.js";
export type { RunNarrateOptions, NarrateResult, NarratedScenario } from "./narrate/run-narrate.js";

// Render
export { runRender } from "./render/run-render.js";
export type { RunRenderOptions, RenderResult } from "./render/run-render.js";

// Shoot (render a bundle's declared shots to stills)
export { runShoot, STILLS_DIR } from "./shoot/run-shoot.js";
export type { RunShootOptions, ShootResult } from "./shoot/run-shoot.js";
export type { ShotBrowser, ShotSession, ShotCaptureInfo, ShotTheme } from "./shoot/types.js";

// Serve
export { runServe } from "./serve/run-serve.js";
export type { RunServeOptions, ServeResult } from "./serve/run-serve.js";
export { startBundleServer, createBundleServer } from "./serve/static-server.js";
export type { BundleServerHandle, StartBundleServerOptions } from "./serve/static-server.js";

// Publish (GitHub Pages)
export { runPublish } from "./publish/run-publish.js";
export type { RunPublishOptions, PublishRunResult } from "./publish/run-publish.js";
export {
  runPublishFlow,
  validateRepoName,
  validatePublishPath,
  normalizePath,
  pagesUrl,
  repoUrl,
} from "./publish/publish-flow.js";
export type {
  PublishFlowDeps,
  PublishOptions,
  PublishResult,
} from "./publish/publish-flow.js";
export { createGithubPublisher } from "./publish/github.js";

// Install (bootstrap a demos project: scaffold + add deps + run the package manager)
export { runInstall } from "./install/run-install.js";
export type {
  RunInstallOptions,
  RunInstallResult,
  ParsedSpec,
  PackageManager,
} from "./install/run-install.js";

// Validate
export { validateScenario } from "./validate/scenario-validator.js";
export { loadScenarioYaml } from "./util/load-yaml.js";

// Bundle helpers (viewport + embed snippet)
export { readBundleViewport } from "./bundle/read-viewport.js";
export type { BundleViewport } from "./bundle/read-viewport.js";
export { buildEmbedSnippet } from "./embed/embed-snippet.js";
export { DEFAULT_VIEWPORT, parseViewport } from "./pack/viewport.js";
export type { Viewport } from "./pack/viewport.js";
