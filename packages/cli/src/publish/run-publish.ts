import { resolve, join, basename } from "node:path";
import { stat, readFile } from "node:fs/promises";
import { PACK_MANIFEST_FILE } from "../pack/pack-manifest.js";
import { buildEmbedSnippet, buildEnhancedEmbedSnippet } from "../deploy/embed-snippet.js";
import { readBundleViewport } from "../bundle/read-viewport.js";
import type { Viewport } from "../pack/viewport.js";
import { createGithubPublisher } from "./github.js";
import {
  runPublishFlow,
  validateRepoName,
  validatePublishPath,
  normalizePath,
  type PublishFlowDeps,
  type PublishResult,
} from "./publish-flow.js";

/** The servable entry every packed bundle contains at its root. */
const INDEX_FILE = "index.html";

/** Repo-name rule for the default (same shape as scenario slugs). */
const REPO_FALLBACK_PATTERN = /^[a-z][a-z0-9-]*[a-z0-9]$/;

/**
 * Default shared repo for embeds. Many tours live here, each under its own slug
 * path, so previews never land in the user's source repo. Override with --repo.
 */
const DEFAULT_REPO = "scenar-embeds";

/** Options for {@link runPublish}. */
export interface RunPublishOptions {
  readonly bundleDir: string;
  /** Target repository name (default: {@link DEFAULT_REPO}). */
  readonly repo?: string;
  /**
   * Subdirectory within the repo (default: the packed scenario slug). Pass "/"
   * or "" to publish at the repo root (a dedicated single-tour repo).
   */
  readonly path?: string;
  /** Target GitHub org (default: the authenticated user). */
  readonly org?: string;
  /** Create the repo private (GitHub Pages needs Pro for private repos). */
  readonly private?: boolean;
  /** Commit message for the published snapshot. */
  readonly message?: string;
  /** Progress sink for flow messages. */
  readonly onLog?: (message: string) => void;
  /**
   * Override the publish backend (the gh/git deps). Defaults to the real
   * {@link createGithubPublisher}; tests inject a fake to avoid live calls.
   */
  readonly deps?: Omit<PublishFlowDeps, "log">;
}

/** The published location plus the derived embed snippet. */
export interface PublishRunResult {
  readonly result: PublishResult;
  readonly viewport: Viewport;
  readonly recordedViewport: boolean;
  readonly snippet: string;
  /** The optional <scenar-embed> loader snippet (auto-fit + theme sync). */
  readonly enhancedSnippet: string;
}

/**
 * Validate a packed bundle and publish it to GitHub Pages — the orchestration
 * behind `scenar publish`, with no process/exit coupling. Resolves the default
 * repo name, runs the publish flow, and builds the embed snippet. Throws on an
 * invalid bundle, an invalid repo name, or any flow failure.
 */
export async function runPublish(options: RunPublishOptions): Promise<PublishRunResult> {
  const onLog = options.onLog ?? (() => {});
  const resolvedDir = resolve(options.bundleDir);

  const info = await stat(resolvedDir).catch(() => null);
  if (!info || !info.isDirectory()) {
    throw new Error(
      `${options.bundleDir} is not a directory. Pass a bundle produced by \`scenar pack\`.`,
    );
  }
  const indexInfo = await stat(join(resolvedDir, INDEX_FILE)).catch(() => null);
  if (!indexInfo || !indexInfo.isFile()) {
    throw new Error(
      `no ${INDEX_FILE} in ${options.bundleDir}. Run \`scenar pack\` to produce a servable bundle first.`,
    );
  }

  const slug = await scenarioSlug(resolvedDir);

  const repo = options.repo ?? DEFAULT_REPO;
  const repoError = validateRepoName(repo);
  if (repoError) {
    throw new Error(`${repoError}. Pass --repo <name> to override.`);
  }

  // Path defaults to the scenario slug so tours coexist in one repo; an explicit
  // "/" (or "") publishes at the repo root.
  const path = normalizePath(options.path ?? slug);
  const pathError = validatePublishPath(path);
  if (pathError) {
    throw new Error(`${pathError}. Pass --path <subpath> to override.`);
  }

  const deps: PublishFlowDeps = { ...(options.deps ?? createGithubPublisher()), log: onLog };
  const result = await runPublishFlow(deps, {
    bundleDir: resolvedDir,
    repo,
    path,
    org: options.org,
    private: Boolean(options.private),
    message: options.message ?? "Publish Scenar embed",
  });

  const { viewport, recorded } = await readBundleViewport(resolvedDir);
  const snippet = buildEmbedSnippet({ embedUrl: result.pagesUrl, viewport });
  const enhancedSnippet = buildEnhancedEmbedSnippet({ embedUrl: result.pagesUrl, viewport });

  return { result, viewport, recordedViewport: recorded, snippet, enhancedSnippet };
}

/**
 * The packed scenario slug (from pack-manifest.json), falling back to the bundle
 * directory's base name. Used as the default publish subpath. The downstream
 * validatePublishPath guards the result.
 */
async function scenarioSlug(bundleDir: string): Promise<string> {
  try {
    const raw = await readFile(join(bundleDir, PACK_MANIFEST_FILE), "utf-8");
    const id = (JSON.parse(raw) as { scenarioId?: unknown }).scenarioId;
    if (typeof id === "string" && REPO_FALLBACK_PATTERN.test(id)) return id;
  } catch {
    // No/invalid manifest — fall back to the directory name.
  }
  return basename(bundleDir);
}
