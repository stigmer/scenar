import * as path from "path";
import {
  scanProject,
  generate,
  initMswServiceWorker,
  type ScanResult,
  type GenerateResult,
  type InitMswResult,
} from "@scenar/preview";

/**
 * Options for the scan -> generate (-> MSW) pipeline that backs `scenar install`.
 */
export interface GeneratePipelineOptions {
  /** Absolute path to the project to scan for components. */
  readonly sourceRoot: string;
  /** Absolute path to the `.scenar/` output directory. */
  readonly outputDir: string;
  /**
   * First-time generation. Controls split-ownership in {@link generate}:
   * user-owned files (`scenar.config.ts`, and `providers.tsx` under
   * `--reset-providers`) are only created on init.
   */
  readonly isInit: boolean;
  /** Force-regenerate `providers.tsx` (only meaningful when `isInit`). */
  readonly resetProviders?: boolean;
  /** Also scaffold the MSW service worker (init does; sync does not). */
  readonly initMsw?: boolean;
}

/** Result of the shared generation pipeline. */
export interface GeneratePipelineResult {
  readonly scan: ScanResult;
  readonly generate: GenerateResult;
  /** Present only when `initMsw` was requested. */
  readonly msw?: InitMswResult;
}

/**
 * Run the scan -> generate (-> MSW) sequence once.
 *
 * This is the single source of truth for turning a project directory into a
 * `.scenar/` registry. Callers own their own console output; this function only
 * performs the work and returns structured results so each command can print in
 * its own voice without duplicating the orchestration.
 */
export function runGeneratePipeline(
  options: GeneratePipelineOptions,
): GeneratePipelineResult {
  const { sourceRoot, outputDir, isInit, resetProviders, initMsw } = options;

  const scan = scanProject(sourceRoot);

  const generateResult = generate(scan, {
    sourceRoot,
    outputDir,
    isInit,
    resetProviders,
  });

  let msw: InitMswResult | undefined;
  if (initMsw) {
    // The MSW worker lives in the project's public/ dir — i.e. alongside
    // `.scenar/`, one level up from the output directory.
    const projectRoot = path.resolve(path.dirname(outputDir));
    msw = initMswServiceWorker(projectRoot, scan.framework);
  }

  return { scan, generate: generateResult, msw };
}
