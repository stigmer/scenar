import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "node:child_process";
import { parse as parseYaml } from "yaml";
import { scaffoldProject, type ScaffoldResult } from "./scaffold.js";

/** Supported package managers, detected by lockfile / workspace manifest. */
export type PackageManager = "npm" | "yarn" | "pnpm";

/** A dependency parsed from a positional install argument. */
export interface ParsedSpec {
  /** The package name (registry key written into `dependencies`). */
  readonly name: string;
  /**
   * The version range / locator to record. Empty string means "bare" — the
   * concrete value is decided at merge time (`workspace:*` for a workspace
   * member, otherwise `*`, later pinned to the installed version).
   */
  readonly range: string;
}

export interface RunInstallOptions {
  /** Project directory to operate in (absolute or relative to cwd). */
  readonly cwd: string;
  /** Positional dependency specs to add (names, ranges, file:/git/workspace). */
  readonly packages: readonly string[];
  /** Line-oriented log sink (the CLI wires this to stderr). */
  readonly onLog: (line: string) => void;
  /** Scaffold and record deps but skip the package-manager subprocess. */
  readonly skipInstall?: boolean;
  /** Force a package manager instead of detecting one. */
  readonly packageManager?: PackageManager;
}

export interface RunInstallResult {
  /** Whether a fresh project was scaffolded (no prior `package.json`). */
  readonly scaffolded: boolean;
  /** Files created by scaffolding, relative to the project directory. */
  readonly scaffoldCreated: readonly string[];
  /** Dependencies added (or already present) from the positional specs. */
  readonly added: readonly ParsedSpec[];
  /** The package manager used. */
  readonly packageManager: PackageManager;
  /** Workspace root if the project is a workspace member, else null. */
  readonly workspaceRoot: string | null;
  /** Whether the package-manager install actually ran. */
  readonly installRan: boolean;
}

/**
 * Bootstrap a Scenar demos project: scaffold (if empty), record the requested
 * component packages as ordinary dependencies, and run the package manager.
 *
 * The command is intentionally resolver-agnostic — it only writes dependency
 * entries and delegates resolution to the package manager — so a positional
 * argument can be a registry version, a `workspace:*` spec, a `file:`/`link:`
 * path, or a git URL. Dependency resolution is the package manager's job, not
 * ours.
 */
export function runInstall(options: RunInstallOptions): RunInstallResult {
  const cwd = path.resolve(options.cwd);
  const pkgPath = path.join(cwd, "package.json");

  // --- 1. Scaffold a fresh project if there's no package.json yet. ---
  let scaffolded = false;
  let scaffold: ScaffoldResult = { created: [] };
  if (!fs.existsSync(pkgPath)) {
    scaffold = scaffoldProject(cwd);
    scaffolded = true;
    options.onLog(`\x1b[36m●\x1b[0m Scaffolded a new Scenar demos project`);
    for (const file of scaffold.created) {
      options.onLog(`  \x1b[32m✓\x1b[0m ${file}`);
    }
  }

  // --- 2. Detect workspace + package manager. ---
  const workspaceRoot = findWorkspaceRoot(cwd);
  const packageManager =
    options.packageManager ?? detectPackageManager(workspaceRoot ?? cwd);
  const installDir = workspaceRoot ?? cwd;

  // --- 3. Record the requested packages as dependencies. ---
  const added = options.packages.map((raw) => parseSpec(raw, cwd));
  if (added.length > 0) {
    const memberNames = workspaceRoot
      ? workspaceMemberNames(workspaceRoot)
      : new Set<string>();
    mergeDependencies(pkgPath, added, { packageManager, memberNames });
    options.onLog(`\x1b[36m●\x1b[0m Added dependencies`);
    for (const spec of added) {
      options.onLog(`  \x1b[32m✓\x1b[0m ${spec.name}`);
    }
  }

  // --- 4. Install. ---
  let installRan = false;
  if (!options.skipInstall) {
    options.onLog(
      `\n\x1b[36m●\x1b[0m Installing with ${packageManager}` +
        (workspaceRoot ? ` (workspace root: ${path.relative(cwd, installDir) || "."})` : ""),
    );
    runPackageManagerInstall(packageManager, installDir);
    installRan = true;
    // Bare registry specs were written as "*"; pin them to what actually
    // resolved so the project gets a clean, reproducible package.json.
    pinResolvedRanges(pkgPath, added);
  }

  return {
    scaffolded,
    scaffoldCreated: scaffold.created,
    added,
    packageManager,
    workspaceRoot,
    installRan,
  };
}

// ---------------------------------------------------------------------------
// Dependency-spec parsing
// ---------------------------------------------------------------------------

/** Locator-prefixed specs whose name lives in the target, not the string. */
const PATH_SPEC_RE = /^(file:|link:)(.+)$/;
const URL_SPEC_RE = /^(git\+|git:|https?:|github:|bitbucket:|gitlab:)/;

/**
 * Parse one positional install argument into a `{ name, range }` pair.
 *
 * Handles the common forms (`name`, `name@range`, `@scope/name`,
 * `@scope/name@range`), resolves `file:`/`link:` names from the target's
 * `package.json`, and rejects git/URL specs that carry no package name (the
 * user should add those to `package.json` directly, then re-run).
 */
export function parseSpec(raw: string, cwd: string): ParsedSpec {
  const spec = raw.trim();

  const pathMatch = PATH_SPEC_RE.exec(spec);
  if (pathMatch) {
    const target = path.resolve(cwd, pathMatch[2]!);
    const name = readPackageName(target);
    if (!name) {
      throw new Error(
        `could not read a package name from "${spec}". Make sure the path ` +
          `points at a directory containing a package.json.`,
      );
    }
    return { name, range: spec };
  }

  if (URL_SPEC_RE.test(spec)) {
    throw new Error(
      `git/URL dependency "${spec}" has no package name. Add it to ` +
        `package.json (e.g. "your-pkg": "${spec}") and run \`scenar install\`.`,
    );
  }

  // name | name@range | @scope/name | @scope/name@range
  const scoped = spec.startsWith("@");
  const at = spec.indexOf("@", scoped ? 1 : 0);
  if (at === -1) return { name: spec, range: "" };
  return { name: spec.slice(0, at), range: spec.slice(at + 1) };
}

// ---------------------------------------------------------------------------
// package.json mutation
// ---------------------------------------------------------------------------

interface MergeContext {
  readonly packageManager: PackageManager;
  readonly memberNames: ReadonlySet<string>;
}

/**
 * Merge parsed specs into `dependencies`, idempotently. Existing pins are kept
 * when the user passed a bare name; an explicit range always wins. Bare names
 * that match a workspace member become `workspace:*` (pnpm/yarn) or `*` (npm),
 * and other bare names default to `*` (pinned post-install).
 */
function mergeDependencies(
  pkgPath: string,
  specs: readonly ParsedSpec[],
  ctx: MergeContext,
): void {
  const pkg = readJson(pkgPath);
  const deps: Record<string, string> = { ...(pkg.dependencies ?? {}) };

  for (const { name, range } of specs) {
    if (range === "" && deps[name]) continue; // keep existing pin

    if (range !== "") {
      deps[name] = range;
    } else if (ctx.memberNames.has(name)) {
      deps[name] =
        ctx.packageManager === "npm" ? "*" : "workspace:*";
    } else {
      deps[name] = "*";
    }
  }

  pkg.dependencies = sortKeys(deps);
  writeJson(pkgPath, pkg);
}

/**
 * Replace any `"*"` dependency ranges with `^<installed version>` after a
 * successful install, so a bare `scenar install @foo/bar` yields a clean,
 * reproducible pin. Best-effort: workspace specs and unresolved packages are
 * left untouched.
 */
function pinResolvedRanges(pkgPath: string, specs: readonly ParsedSpec[]): void {
  const pkg = readJson(pkgPath);
  const deps: Record<string, string> = pkg.dependencies ?? {};
  const nodeModules = path.join(path.dirname(pkgPath), "node_modules");
  let changed = false;

  for (const name of new Set(specs.map((s) => s.name))) {
    if (deps[name] !== "*") continue;
    const version = readPackageVersion(path.join(nodeModules, name));
    if (version) {
      deps[name] = `^${version}`;
      changed = true;
    }
  }

  if (changed) {
    pkg.dependencies = deps;
    writeJson(pkgPath, pkg);
  }
}

// ---------------------------------------------------------------------------
// Workspace + package-manager detection
// ---------------------------------------------------------------------------

/**
 * Walk up from `startDir` to find the nearest workspace root that actually
 * contains `startDir` as a member — a directory with a `pnpm-workspace.yaml`
 * or a `package.json` `workspaces` field whose globs match `startDir`. Returns
 * null when the project is standalone.
 */
export function findWorkspaceRoot(startDir: string): string | null {
  let dir = path.resolve(startDir);
  // The project's own package.json is never its workspace root, so start above.
  let current = path.dirname(dir);

  while (true) {
    const globs = readWorkspaceGlobs(current);
    if (globs && matchesAnyGlob(path.relative(current, dir), globs)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

/** Read workspace package globs from pnpm-workspace.yaml or package.json. */
function readWorkspaceGlobs(dir: string): string[] | null {
  const pnpmManifest = path.join(dir, "pnpm-workspace.yaml");
  if (fs.existsSync(pnpmManifest)) {
    try {
      const parsed = parseYaml(fs.readFileSync(pnpmManifest, "utf-8")) as
        | { packages?: string[] }
        | null;
      if (Array.isArray(parsed?.packages)) return parsed.packages;
    } catch {
      // Malformed manifest — fall through to package.json.
    }
  }

  const pkgPath = path.join(dir, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = readJson(pkgPath);
      const ws = pkg.workspaces;
      if (Array.isArray(ws)) return ws as string[];
      if (ws && Array.isArray((ws as { packages?: string[] }).packages)) {
        return (ws as { packages: string[] }).packages;
      }
    } catch {
      // Ignore unreadable package.json.
    }
  }

  return null;
}

/** Test a member path (relative to the workspace root) against workspace globs. */
function matchesAnyGlob(relMember: string, globs: readonly string[]): boolean {
  const normalized = relMember.split(path.sep).join("/");
  return globs.some((glob) => globToRegExp(glob).test(normalized));
}

/**
 * Convert a workspace glob (e.g. `packages/*`, `apps/**`) to a RegExp. Supports
 * the `*` (one segment) and `**` (any depth) wildcards that workspace manifests
 * use; everything else is matched literally.
 */
function globToRegExp(glob: string): RegExp {
  const trimmed = glob.replace(/\/+$/, "");
  let re = "";
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i]!;
    if (c === "*") {
      if (trimmed[i + 1] === "*") {
        re += ".*";
        i++;
        if (trimmed[i + 1] === "/") i++;
      } else {
        re += "[^/]*";
      }
    } else if (/[.+?^${}()|[\]\\]/.test(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`);
}

/** Collect the package names of all workspace members under `root`. */
function workspaceMemberNames(root: string): Set<string> {
  const names = new Set<string>();
  const globs = readWorkspaceGlobs(root);
  if (!globs) return names;

  for (const glob of globs) {
    for (const memberDir of expandGlobDirs(root, glob)) {
      const name = readPackageName(memberDir);
      if (name) names.add(name);
    }
  }
  return names;
}

/**
 * Expand a single workspace glob into existing member directories. Only the
 * `pkgs/*` and `pkgs/**` shapes that workspace manifests use are supported;
 * each candidate is kept only if it contains a `package.json`.
 */
function expandGlobDirs(root: string, glob: string): string[] {
  const trimmed = glob.replace(/\/+$/, "");
  const parts = trimmed.split("/");
  let dirs = [root];

  for (const part of parts) {
    const next: string[] = [];
    for (const dir of dirs) {
      if (part === "*" || part === "**") {
        for (const entry of safeReaddir(dir)) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) next.push(full);
        }
      } else {
        const full = path.join(dir, part);
        if (fs.existsSync(full)) next.push(full);
      }
    }
    dirs = next;
  }

  return dirs.filter((dir) => fs.existsSync(path.join(dir, "package.json")));
}

/**
 * Detect the package manager by the nearest lockfile, walking up from `dir`.
 * Defaults to npm when nothing is found.
 */
export function detectPackageManager(dir: string): PackageManager {
  let current = path.resolve(dir);
  while (true) {
    if (fs.existsSync(path.join(current, "pnpm-lock.yaml"))) return "pnpm";
    if (fs.existsSync(path.join(current, "yarn.lock"))) return "yarn";
    if (fs.existsSync(path.join(current, "package-lock.json"))) return "npm";
    const parent = path.dirname(current);
    if (parent === current) return "npm";
    current = parent;
  }
}

// ---------------------------------------------------------------------------
// Subprocess
// ---------------------------------------------------------------------------

/** Run `<pm> install` in `dir`, throwing a clear error on failure. */
function runPackageManagerInstall(pm: PackageManager, dir: string): void {
  const result = spawnSync(pm, ["install"], {
    cwd: dir,
    stdio: "inherit",
    // Windows resolves npm/yarn/pnpm via the shell.
    shell: process.platform === "win32",
  });

  if (result.error) {
    const code = (result.error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error(
        `${pm} was not found on your PATH. Install it, or pass ` +
          `--package-manager <npm|yarn|pnpm>.`,
      );
    }
    throw result.error;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    throw new Error(
      `${pm} install failed (exit code ${result.status}). If a package is ` +
        `private or unpublished, check your registry access and authentication.`,
    );
  }
}

// ---------------------------------------------------------------------------
// JSON / fs helpers
// ---------------------------------------------------------------------------

function readJson(file: string): Record<string, any> {
  return JSON.parse(fs.readFileSync(file, "utf-8")) as Record<string, any>;
}

function writeJson(file: string, value: unknown): void {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", "utf-8");
}

function readPackageName(dir: string): string | null {
  const pkgPath = path.join(dir, "package.json");
  if (!fs.existsSync(pkgPath)) return null;
  try {
    const name = readJson(pkgPath).name;
    return typeof name === "string" && name.length > 0 ? name : null;
  } catch {
    return null;
  }
}

function readPackageVersion(dir: string): string | null {
  const pkgPath = path.join(dir, "package.json");
  if (!fs.existsSync(pkgPath)) return null;
  try {
    const version = readJson(pkgPath).version;
    return typeof version === "string" && version.length > 0 ? version : null;
  } catch {
    return null;
  }
}

function safeReaddir(dir: string): fs.Dirent[] {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/** Sort object keys so generated package.json deps stay stable across runs. */
function sortKeys(obj: Record<string, string>): Record<string, string> {
  const sorted: Record<string, string> = {};
  for (const key of Object.keys(obj).sort()) sorted[key] = obj[key]!;
  return sorted;
}
