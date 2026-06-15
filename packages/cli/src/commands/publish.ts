import { Command } from "commander";
import { runPublish } from "../publish/run-publish.js";

interface PublishCommandOptions {
  repo?: string;
  path?: string;
  org?: string;
  private?: boolean;
  message?: string;
}

export function registerPublishCommand(program: Command): void {
  program
    .command("publish")
    .description(
      "Publish a packed bundle to GitHub Pages and print its public embed URL.\n\n" +
        "Takes a bundle directory produced by `scenar pack`. Creates (or reuses)\n" +
        "a GitHub repo, publishes the bundle to its gh-pages branch, enables\n" +
        "GitHub Pages, and prints the public URL plus a ready-to-paste <iframe>\n" +
        "snippet.\n\n" +
        "By default many tours share one repo: --repo defaults to `scenar-embeds`\n" +
        "and --path to the packed scenario slug, so the embed serves at\n" +
        "https://<you>.github.io/scenar-embeds/<slug>/ and re-publishing one tour\n" +
        "preserves the others. Pass --path / to publish at the repo root\n" +
        "(a dedicated single-tour repo). Target an org with --org.\n\n" +
        "Requires the GitHub CLI (gh) installed and authenticated (`gh auth\n" +
        "login`). Repos are public by default (GitHub Pages needs Pro for private\n" +
        "repos); pass --private if your plan supports it.\n\n" +
        "For an ephemeral local preview instead, use `scenar serve`.",
    )
    .argument("<bundleDir>", "path to a packed bundle directory (from scenar pack)")
    .option("--repo <name>", "target repository name (default: scenar-embeds)")
    .option("--path <subpath>", "subdirectory within the repo (default: the scenario slug; use / for the root)")
    .option("--org <org>", "publish under a GitHub organization instead of your user account")
    .option("--private", "create the repo private (GitHub Pages requires a paid plan for this)")
    .option("--message <msg>", "commit message for the published snapshot", "Publish Scenar embed")
    .action(async (bundleDir: string, options: PublishCommandOptions) => {
      try {
        process.stderr.write(`Bundle:   ${bundleDir}\n`);
        process.stderr.write(
          `Target:   ${options.org ? `${options.org}/` : ""}${options.repo ?? "scenar-embeds"}` +
            `/${options.path ?? "(scenario slug)"} (GitHub Pages)\n\n`,
        );

        const { result, viewport, recordedViewport, snippet, enhancedSnippet } = await runPublish({
          bundleDir,
          repo: options.repo,
          path: options.path,
          org: options.org,
          private: Boolean(options.private),
          message: options.message,
          onLog: (message) => process.stderr.write(`${message}\n`),
        });

        const location = result.path ? `${result.owner}/${result.repo}/${result.path}` : `${result.owner}/${result.repo}`;
        process.stderr.write(
          `\n\x1b[32m✓\x1b[0m ${result.created ? "Created" : "Updated"} ${location}\n`,
        );
        process.stderr.write(`  Repo: ${result.repoUrl}\n`);
        // Bare public URL to stdout (pipeable); everything else to stderr.
        process.stdout.write(`${result.pagesUrl}\n`);
        process.stderr.write(
          "\n  GitHub Pages builds asynchronously; the URL goes live in ~1 minute on the first publish.\n",
        );

        if (!recordedViewport) {
          process.stderr.write(
            "  Note: no recorded viewport; snippet uses the default " +
              `${viewport.width}x${viewport.height}. Re-pack with the current CLI ` +
              "to embed at the exact aspect ratio.\n",
          );
        }
        process.stderr.write("\n  Embed snippet (paste into any page):\n\n");
        process.stderr.write(`${indent(snippet)}\n`);
        process.stderr.write(
          "\n  Or, for auto-fit + light/dark sync, the <scenar-embed> loader:\n\n",
        );
        process.stderr.write(`${indent(enhancedSnippet)}\n`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        process.stderr.write(`\x1b[31mError:\x1b[0m ${msg}\n`);
        process.exitCode = 1;
      }
    });
}

/** Indent every line by two spaces (for nesting a block under a heading). */
function indent(block: string): string {
  return block.replace(/^/gm, "  ");
}
