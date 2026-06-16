import { resolve, join } from "node:path";
import { stat } from "node:fs/promises";
import { buildEmbedSnippet, buildEnhancedEmbedSnippet } from "../embed/embed-snippet.js";
import { localViewUrl } from "./local-url.js";
import { readBundleViewport } from "../bundle/read-viewport.js";
import type { Viewport } from "../pack/viewport.js";
import { startBundleServer, type BundleServerHandle } from "./static-server.js";

/** The servable entry every packed bundle contains at its root. */
const INDEX_FILE = "index.html";

/** Options for {@link runServe}. */
export interface RunServeOptions {
  readonly bundleDir: string;
  /** Port to bind; 0 lets the OS choose a free one. */
  readonly port: number;
  /** Host/interface to bind (default: localhost). */
  readonly host?: string;
}

/** A running preview server plus the derived presentation details. */
export interface ServeResult {
  /** The running server (call .close() to stop). */
  readonly handle: BundleServerHandle;
  /** The browser-clickable URL (https→http downgraded for *.localhost). */
  readonly url: string;
  /** A ready-to-paste responsive <iframe> snippet for this URL. */
  readonly snippet: string;
  /** The optional <scenar-embed> loader snippet (auto-fit + theme sync). */
  readonly enhancedSnippet: string;
  /** The viewport used for the snippet (recorded, or the default). */
  readonly viewport: Viewport;
  /** Whether the snippet's viewport came from the bundle (vs. the default). */
  readonly recordedViewport: boolean;
}

/**
 * Validate a packed bundle directory and start serving it — the orchestration
 * behind `scenar serve`, with no process/exit coupling so both the CLI command
 * and the MCP server can call it. The returned handle keeps running until the
 * caller closes it. Throws on an invalid bundle or an unavailable port.
 */
export async function runServe(options: RunServeOptions): Promise<ServeResult> {
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

  const handle = await startBundleServer({
    rootDir: resolvedDir,
    port: options.port,
    host: options.host,
  });

  const url = localViewUrl(handle.url);
  const { viewport, recorded } = await readBundleViewport(resolvedDir);
  const snippet = buildEmbedSnippet({ embedUrl: url, viewport });
  const enhancedSnippet = buildEnhancedEmbedSnippet({ embedUrl: url, viewport });

  return { handle, url, snippet, enhancedSnippet, viewport, recordedViewport: recorded };
}
