/**
 * GitHub Pages publishing — the OSS "permanent public URL" path of Phase 1.
 *
 * The flow is dependency-injected (mirroring deploy-flow.ts) so its ordering and
 * payloads are unit-testable against fakes, with zero live GitHub calls in the
 * test suite. The real `gh`/`git` implementations live in ./github.ts.
 */

/** A repo name's allowed characters (GitHub: alphanumerics, ., _, -). */
const REPO_NAME_PATTERN = /^[A-Za-z0-9._-]+$/;

/** GitHub caps repository names at 100 characters. */
const MAX_REPO_NAME_LENGTH = 100;

/** Allowed characters for a single publish path segment. */
const PATH_SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/;

/** Identity for the target GitHub repository + how to write to it. */
export interface PublishOptions {
  /** The packed bundle directory to publish. */
  readonly bundleDir: string;
  /** Target repository name (default: the scenario slug). */
  readonly repo: string;
  /**
   * Subdirectory within the repo to publish into, normalized (no leading/
   * trailing slashes). Empty string means the repo root — a dedicated,
   * single-tour repo whose every publish replaces the whole branch. A non-empty
   * path (e.g. `welcome-tour`) lets many tours coexist in one repo; publishing
   * replaces only that subfolder and preserves its siblings.
   */
  readonly path: string;
  /** Target owner (a GitHub org); omitted means the authenticated user. */
  readonly org?: string;
  /** Create the repo private rather than public (Pages needs Pro for private). */
  readonly private: boolean;
  /** Commit message for the published snapshot. */
  readonly message: string;
}

/** The published location. */
export interface PublishResult {
  readonly owner: string;
  readonly repo: string;
  /** The subdirectory the embed was published into ("" for the repo root). */
  readonly path: string;
  /** The repository's web URL. */
  readonly repoUrl: string;
  /** The GitHub Pages URL the embed is served at (includes the path). */
  readonly pagesUrl: string;
  /** True when the repo was created by this run (vs. reused). */
  readonly created: boolean;
}

/**
 * The side-effecting operations the flow depends on, injected so the ordering
 * can be tested without `gh`, `git`, or the network.
 */
export interface PublishFlowDeps {
  /** Verify `gh` + `git` are installed and `gh` is authenticated; else throw. */
  ensureToolsAvailable(): Promise<void>;
  /** Resolve the target owner: the explicit org, or the authenticated user. */
  resolveOwner(explicitOrg: string | undefined): Promise<string>;
  /** Whether owner/repo already exists. */
  repoExists(owner: string, repo: string): Promise<boolean>;
  /** Create owner/repo (public unless private requested). */
  createRepo(owner: string, repo: string, opts: { private: boolean; description: string }): Promise<void>;
  /**
   * Publish the bundle (plus a root .nojekyll) to the repo's gh-pages branch.
   * An empty `path` replaces the whole branch (dedicated repo); a non-empty
   * `path` updates only that subfolder, preserving sibling tours already on the
   * branch.
   */
  pushBundleToPages(input: {
    bundleDir: string;
    owner: string;
    repo: string;
    path: string;
    message: string;
  }): Promise<void>;
  /** Enable GitHub Pages from gh-pages (idempotent — a no-op if already on). */
  enablePages(owner: string, repo: string): Promise<void>;
  /** Progress sink (stderr in the command; captured in tests). */
  log(message: string): void;
}

/**
 * Validate a GitHub repository name. Returns an error message, or null if valid.
 * The scenario slug (the default) is always valid; this guards an explicit
 * `--repo` before any repo is touched.
 */
export function validateRepoName(repo: string): string | null {
  if (repo.length === 0 || repo.length > MAX_REPO_NAME_LENGTH) {
    return `repo name must be 1-${MAX_REPO_NAME_LENGTH} characters`;
  }
  if (repo === "." || repo === "..") {
    return `repo name must not be "." or ".."`;
  }
  if (!REPO_NAME_PATTERN.test(repo)) {
    return `invalid repo name "${repo}"; allowed: letters, digits, ".", "_", "-"`;
  }
  return null;
}

/**
 * Normalize a publish path to a clean, slash-separated subpath with no leading,
 * trailing, or doubled slashes. `/`, `.`, and empty all normalize to "" (root).
 */
export function normalizePath(path: string | undefined): string {
  return (path ?? "")
    .split("/")
    .map((seg) => seg.trim())
    .filter((seg) => seg.length > 0 && seg !== ".")
    .join("/");
}

/**
 * Validate a (pre-normalized) publish subpath. Returns an error message, or null
 * if valid. "" (root) is always valid; each segment must be a safe slug and
 * never `..` (no directory traversal into the branch).
 */
export function validatePublishPath(path: string): string | null {
  if (path.length === 0) return null;
  for (const seg of path.split("/")) {
    if (seg === "..") return `path must not contain ".."`;
    if (!PATH_SEGMENT_PATTERN.test(seg)) {
      return `invalid path segment "${seg}"; allowed: letters, digits, ".", "_", "-"`;
    }
  }
  return null;
}

/**
 * The GitHub Pages URL for owner/repo, optionally under a subpath. A repository
 * named exactly `<owner>.github.io` is the user/org site and serves at the apex;
 * every other repo serves under its name as a path (which is why packed bundles
 * use a relative base so they work from a subpath). A non-empty `path` appends a
 * further subdirectory so many tours can share one repo.
 */
export function pagesUrl(owner: string, repo: string, path?: string): string {
  const host = `${owner.toLowerCase()}.github.io`;
  const base = repo.toLowerCase() === host ? `https://${host}/` : `https://${host}/${repo}/`;
  const clean = normalizePath(path);
  return clean ? `${base}${clean}/` : base;
}

/** The repository's web URL. */
export function repoUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}`;
}

/**
 * Drive the publish: verify tooling, resolve the owner, ensure the repo exists,
 * push the bundle to gh-pages, and enable Pages. Ordering is load-bearing — the
 * repo must exist before the push, and the gh-pages branch must exist (from the
 * push) before Pages can be pointed at it.
 */
export async function runPublishFlow(
  deps: PublishFlowDeps,
  opts: PublishOptions,
): Promise<PublishResult> {
  await deps.ensureToolsAvailable();

  const owner = await deps.resolveOwner(opts.org);
  const exists = await deps.repoExists(owner, opts.repo);
  if (!exists) {
    deps.log(`Creating ${opts.private ? "private" : "public"} repo ${owner}/${opts.repo}...`);
    await deps.createRepo(owner, opts.repo, {
      private: opts.private,
      description: "Scenar embed — published with `scenar publish`.",
    });
  } else {
    deps.log(`Reusing existing repo ${owner}/${opts.repo}...`);
  }

  deps.log(
    opts.path
      ? `Publishing into ${opts.repo}/${opts.path}/ on the gh-pages branch...`
      : "Pushing bundle to the gh-pages branch...",
  );
  await deps.pushBundleToPages({
    bundleDir: opts.bundleDir,
    owner,
    repo: opts.repo,
    path: opts.path,
    message: opts.message,
  });

  deps.log("Enabling GitHub Pages...");
  await deps.enablePages(owner, opts.repo);

  return {
    owner,
    repo: opts.repo,
    path: opts.path,
    repoUrl: repoUrl(owner, opts.repo),
    pagesUrl: pagesUrl(owner, opts.repo, opts.path),
    created: !exists,
  };
}
