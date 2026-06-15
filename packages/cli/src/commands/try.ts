import { spawn } from "node:child_process";
import { platform } from "node:process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { stat } from "node:fs/promises";
import { Command } from "commander";
import { runServe } from "../serve/run-serve.js";
import type { BundleServerHandle } from "../serve/static-server.js";

/** Vite's preview port — the conventional "serve a built site" port. */
const DEFAULT_PORT = 4173;

/** Bind to loopback by default; a preview is a single-developer tool. */
const DEFAULT_HOST = "localhost";

/**
 * The example bundle that ships with the CLI. It's generated at build time
 * (`pack examples/welcome-tour --out dist/example-bundle`, see package.json) and
 * published as part of dist/, so it's present for npx consumers. This module
 * compiles to dist/src/commands/try.js, so the bundle sits two levels up.
 */
const EXAMPLE_BUNDLE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../example-bundle");

interface TryOptions {
  port?: string;
  host?: string;
  open?: boolean;
}

export function registerTryCommand(program: Command): void {
  program
    .command("try")
    .description(
      "Serve the bundled welcome-tour example locally — no app required.\n\n" +
        "Boots the example embed that ships with the CLI on\n" +
        "http://localhost:4173 (override with --port/--host) and prints a\n" +
        "ready-to-paste <iframe> snippet, then stays running until Ctrl+C.\n\n" +
        "This is the fastest way to see what a Scenar embed looks like before\n" +
        "wiring up your own app. To build a tour from your components, see\n" +
        "`scenar preview`; to host one, see `scenar publish`.",
    )
    .option("--port <number>", `port to listen on (default: ${DEFAULT_PORT})`, String(DEFAULT_PORT))
    .option("--host <host>", `host/interface to bind (default: ${DEFAULT_HOST})`, DEFAULT_HOST)
    .option("--open", "open the embed in your default browser")
    .action(async (options: TryOptions) => {
      try {
        const port = Number(options.port);
        if (!Number.isInteger(port) || port < 0 || port > 65535) {
          throw new Error(`invalid --port "${options.port}"; expected an integer between 0 and 65535.`);
        }
        const host = options.host ?? DEFAULT_HOST;

        const bundle = await stat(EXAMPLE_BUNDLE_DIR).catch(() => null);
        if (!bundle || !bundle.isDirectory()) {
          throw new Error(
            "the bundled example is missing. If you installed @scenar/cli from npm, " +
              "reinstall it; if you're running from source, run `pnpm build` first.",
          );
        }

        let result;
        try {
          result = await runServe({ bundleDir: EXAMPLE_BUNDLE_DIR, port, host });
        } catch (error) {
          if (isAddrInUse(error)) {
            throw new Error(
              `port ${port} is already in use. Stop the other process or pass --port <number>.`,
            );
          }
          throw error;
        }

        process.stderr.write(`\n\x1b[32m✓\x1b[0m Serving the welcome-tour example at ${result.url}\n`);
        process.stderr.write("\n  Embed snippet (paste into any page):\n\n");
        process.stderr.write(`${indent(result.snippet)}\n`);
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
