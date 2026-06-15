import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, cp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { PublishFlowDeps } from "./publish-flow.js";

/** Result of running a child process without throwing on a non-zero exit. */
interface RunResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** Run a command, capturing output. Never rejects on a non-zero exit code. */
function run(file: string, args: string[], cwd?: string): Promise<RunResult> {
  return new Promise<RunResult>((resolvePromise) => {
    execFile(file, args, { cwd, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      const code = error && typeof (error as { code?: unknown }).code === "number"
        ? (error as { code: number }).code
        : error
          ? 1
          : 0;
      resolvePromise({ code, stdout: stdout.toString(), stderr: stderr.toString() });
    });
  });
}

/** Commit identity for the published snapshot (Pages ignores authorship). */
const COMMIT_USER = "scenar-cli";
const COMMIT_EMAIL = "scenar-cli@users.noreply.github.com";

/**
 * The branch GitHub Pages currently serves for owner/repo, or null if Pages is
 * not enabled (the GET 404s, so `gh` exits non-zero). The authoritative state
 * check that {@link createGithubPublisher}'s enablePages relies on.
 */
async function getPagesBranch(owner: string, repo: string): Promise<string | null> {
  const result = await run("gh", ["api", `repos/${owner}/${repo}/pages`, "--jq", ".source.branch"]);
  if (result.code !== 0) return null;
  const branch = result.stdout.trim();
  return branch.length > 0 ? branch : null;
}

/**
 * The production {@link PublishFlowDeps} backed by the `gh` CLI and `git`. The
 * `log` sink is supplied by the command; everything here shells out.
 *
 * Auth uses `gh` throughout: API calls go through `gh api`, and the git push
 * borrows gh's credential helper (`gh auth git-credential`) for that one command
 * only — so no token is ever placed on the command line or written to config.
 */
export function createGithubPublisher(): Omit<PublishFlowDeps, "log"> {
  return {
    async ensureToolsAvailable() {
      const git = await run("git", ["--version"]);
      if (git.code !== 0) {
        throw new Error("git is not installed or not on PATH. Install git and retry.");
      }
      const gh = await run("gh", ["--version"]);
      if (gh.code !== 0) {
        throw new Error(
          "the GitHub CLI (gh) is not installed. Install it from https://cli.github.com and retry.",
        );
      }
      const auth = await run("gh", ["auth", "status"]);
      if (auth.code !== 0) {
        throw new Error("not authenticated with GitHub. Run `gh auth login` and retry.");
      }
    },

    async resolveOwner(explicitOrg) {
      if (explicitOrg) return explicitOrg;
      const result = await run("gh", ["api", "user", "--jq", ".login"]);
      const login = result.stdout.trim();
      if (result.code !== 0 || login.length === 0) {
        throw new Error(
          `could not resolve your GitHub username via gh (${result.stderr.trim() || "no output"}).`,
        );
      }
      return login;
    },

    async repoExists(owner, repo) {
      const result = await run("gh", ["repo", "view", `${owner}/${repo}`, "--json", "name"]);
      return result.code === 0;
    },

    async createRepo(owner, repo, opts) {
      const visibility = opts.private ? "--private" : "--public";
      const result = await run("gh", [
        "repo",
        "create",
        `${owner}/${repo}`,
        visibility,
        "--description",
        opts.description,
      ]);
      if (result.code !== 0) {
        throw new Error(`failed to create ${owner}/${repo}: ${result.stderr.trim() || "unknown error"}`);
      }
    },

    async pushBundleToPages({ bundleDir, owner, repo, path, message }) {
      const workDir = await mkdtemp(join(tmpdir(), "scenar-publish-"));
      // Borrow gh's credential helper for network git ops only; no token on argv.
      const cred = ["-c", "credential.helper=!gh auth git-credential"];
      const git = async (args: string[]) => {
        const result = await run("git", args, workDir);
        if (result.code !== 0) {
          throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim() || "unknown error"}`);
        }
        return result;
      };
      try {
        // Stage in a throwaway repo so the user's bundle dir is never turned into
        // a git repo.
        const remote = `https://github.com/${owner}/${repo}.git`;
        await git(["init", "-q"]);
        await git(["remote", "add", "origin", remote]);

        // Subdir publishes build on the existing branch so sibling tours survive;
        // root publishes replace the whole branch (dedicated single-tour repo).
        let basedOnExisting = false;
        if (path) {
          const fetched = await run("git", [...cred, "fetch", "-q", "--depth=1", "origin", "gh-pages"], workDir);
          if (fetched.code === 0) {
            await git(["checkout", "-q", "-B", "gh-pages", "FETCH_HEAD"]);
            basedOnExisting = true;
          } else {
            await git(["checkout", "-q", "-b", "gh-pages"]);
          }
        } else {
          await git(["checkout", "-q", "-B", "gh-pages"]);
        }

        // Replace only the target subfolder (or the whole tree at root). The
        // root .nojekyll makes Pages serve files verbatim (no Jekyll processing
        // of underscore-prefixed paths, etc.).
        const targetDir = path ? join(workDir, path) : workDir;
        if (path) {
          await rm(targetDir, { recursive: true, force: true });
          await mkdir(dirname(targetDir), { recursive: true });
        }
        await cp(bundleDir, targetDir, { recursive: true });
        await writeFile(join(workDir, ".nojekyll"), "", "utf-8");

        await git(["add", "-A"]);

        // Republishing identical content is a no-op — nothing to commit or push.
        const status = await git(["status", "--porcelain"]);
        if (status.stdout.trim().length === 0) return;

        await git([
          "-c", `user.name=${COMMIT_USER}`,
          "-c", `user.email=${COMMIT_EMAIL}`,
          "commit", "-q", "-m", message,
        ]);

        // Fast-forward push when built on the fetched head; otherwise force
        // (creating or replacing the branch wholesale).
        const pushArgs = basedOnExisting
          ? [...cred, "push", "-q", "origin", "gh-pages"]
          : [...cred, "push", "-q", "-f", "origin", "gh-pages"];
        const pushed = await run("git", pushArgs, workDir);
        if (pushed.code !== 0) {
          throw new Error(`git push failed: ${pushed.stderr.trim() || "unknown error"}`);
        }
      } finally {
        await rm(workDir, { recursive: true, force: true }).catch(() => {});
      }
    },

    async enablePages(owner, repo) {
      // Verify state rather than trust POST's exit code. The Pages create
      // endpoint can return an async 202 with an empty body, which makes
      // `gh api` exit non-zero ("unexpected end of JSON input") even though the
      // site was enabled. GET is the authoritative check and is naturally
      // idempotent for re-publishes.
      const current = await getPagesBranch(owner, repo);
      if (current === "gh-pages") return; // already pointed at our branch
      if (current !== null) {
        // Enabled, but from a different branch — repoint it.
        const put = await run("gh", [
          "api",
          "-X",
          "PUT",
          `repos/${owner}/${repo}/pages`,
          "-f",
          "source[branch]=gh-pages",
          "-f",
          "source[path]=/",
        ]);
        if (put.code !== 0) {
          throw new Error(`failed to repoint GitHub Pages to gh-pages: ${put.stderr.trim() || "unknown error"}`);
        }
        return;
      }

      // Not enabled yet — create it, then confirm via GET (ignore the create's
      // noisy exit/parse behaviour and rely on the observed state).
      const post = await run("gh", [
        "api",
        "-X",
        "POST",
        `repos/${owner}/${repo}/pages`,
        "-f",
        "source[branch]=gh-pages",
        "-f",
        "source[path]=/",
      ]);
      const after = await getPagesBranch(owner, repo);
      if (after !== null) return;
      throw new Error(`failed to enable GitHub Pages: ${post.stderr.trim() || "unknown error"}`);
    },
  };
}
