import { spawn } from "node:child_process";
import { platform } from "node:process";
import { Command } from "commander";
import { runServe } from "../serve/run-serve.js";
import type { BundleServerHandle } from "../serve/static-server.js";

/** Vite's preview port — the conventional "serve a built site" port. */
const DEFAULT_PORT = 4173;

/** Bind to loopback by default; a preview is a single-developer tool. */
const DEFAULT_HOST = "localhost";

interface ServeOptions {
  port?: string;
  host?: string;
  open?: boolean;
}

export function registerServeCommand(program: Command): void {
  program
    .command("serve")
    .description(
      "Serve a packed bundle locally and print its embed URL.\n\n" +
        "Takes a bundle directory produced by `scenar pack` and serves it as a\n" +
        "static site on http://localhost:4173 (override with --port/--host).\n" +
        "Prints the URL plus a ready-to-paste responsive <iframe> snippet, then\n" +
        "stays running until you press Ctrl+C.\n\n" +
        "This is the zero-infrastructure way to view an embed: no backend, no\n" +
        "account. For a permanent public URL, use `scenar publish` (GitHub Pages).",
    )
    .argument("<bundleDir>", "path to a packed bundle directory (from scenar pack)")
    .option("--port <number>", `port to listen on (default: ${DEFAULT_PORT})`, String(DEFAULT_PORT))
    .option("--host <host>", `host/interface to bind (default: ${DEFAULT_HOST})`, DEFAULT_HOST)
    .option("--open", "open the embed in your default browser")
    .action(async (bundleDir: string, options: ServeOptions) => {
      try {
        const port = Number(options.port);
        if (!Number.isInteger(port) || port < 0 || port > 65535) {
          throw new Error(`invalid --port "${options.port}"; expected an integer between 0 and 65535.`);
        }
        const host = options.host ?? DEFAULT_HOST;

        let result;
        try {
          result = await runServe({ bundleDir, port, host });
        } catch (error) {
          if (isAddrInUse(error)) {
            throw new Error(
              `port ${port} is already in use. Stop the other process or pass --port <number>.`,
            );
          }
          throw error;
        }

        process.stderr.write(`\n\x1b[32m✓\x1b[0m Serving at ${result.url}\n`);
        if (!result.recordedViewport) {
          process.stderr.write(
            "  Note: no recorded viewport; snippet uses the default " +
              `${result.viewport.width}x${result.viewport.height}. Re-pack with the current CLI ` +
              "to embed at the exact aspect ratio.\n",
          );
        }
        process.stderr.write("\n  Embed snippet (paste into any page):\n\n");
        process.stderr.write(`${indent(result.snippet)}\n`);
        process.stderr.write(
          "\n  Or, for auto-fit + light/dark sync, the <scenar-embed> loader:\n\n",
        );
        process.stderr.write(`${indent(result.enhancedSnippet)}\n`);
        process.stderr.write("\n  Press Ctrl+C to stop.\n");

        if (options.open) {
          openInBrowser(result.url);
        }

        await runUntilInterrupted(result.handle);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        process.stderr.write(`\x1b[31mError:\x1b[0m ${msg}\n`);
        process.exitCode = 1;
      }
    });
}

/** Block until SIGINT/SIGTERM, then close the server cleanly. */
function runUntilInterrupted(handle: BundleServerHandle): Promise<void> {
  return new Promise<void>((resolvePromise) => {
    const shutdown = () => {
      process.stderr.write("\nStopping...\n");
      void handle.close().finally(() => resolvePromise());
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  });
}

/** Best-effort: launch the OS default browser. Failures are silent (non-fatal). */
function openInBrowser(url: string): void {
  const command = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
  try {
    const child = spawn(command, [url], { stdio: "ignore", detached: true, shell: platform === "win32" });
    child.on("error", () => {});
    child.unref();
  } catch {
    // Opening a browser is a convenience; never fail the command over it.
  }
}

function isAddrInUse(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "EADDRINUSE";
}

/** Indent every line by two spaces (for nesting a block under a heading). */
function indent(block: string): string {
  return block.replace(/^/gm, "  ");
}
