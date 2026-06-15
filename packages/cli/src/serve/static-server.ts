import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { contentTypeFor, resolveStaticPath } from "./request-path.js";

/** A running bundle server: where it is reachable and how to stop it. */
export interface BundleServerHandle {
  /** The base URL the bundle is served at (e.g. http://localhost:4173/). */
  readonly url: string;
  /** The port the server actually bound (useful when port 0 was requested). */
  readonly port: number;
  /** Stop accepting connections and release the port. */
  close(): Promise<void>;
}

/** Options for {@link startBundleServer}. */
export interface StartBundleServerOptions {
  /** Bundle directory to serve (a `scenar pack` output). */
  readonly rootDir: string;
  /** Port to bind; 0 lets the OS pick a free one (handy in tests). */
  readonly port: number;
  /** Host/interface to bind. Defaults to "localhost". */
  readonly host?: string;
}

/**
 * Create (but do not start) an HTTP server that serves a packed bundle as a
 * static site. Only GET/HEAD are allowed; every response carries the bundle
 * contract's canonical content type and `Cache-Control: no-cache` (a local
 * preview should always reflect the latest pack, never a stale asset).
 *
 * No CSP or other security headers are emitted: that envelope is the serving
 * edge's responsibility (and is enforced + tested in scenar-cloud). A local
 * preview deliberately matches the headerless behaviour of a plain static host
 * such as GitHub Pages — the other Phase 1 target — so what you see locally is
 * what a `scenar publish` visitor sees.
 */
export function createBundleServer(rootDir: string): Server {
  const root = resolve(rootDir);
  return createServer((req, res) => {
    void serveRequest(root, req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
      res.end("Internal Server Error");
    });
  });
}

async function serveRequest(root: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { allow: "GET, HEAD", "content-type": "text/plain" });
    res.end("Method Not Allowed");
    return;
  }

  const relativePath = resolveStaticPath(req.url ?? "/");
  if (relativePath === null) {
    res.writeHead(400, { "content-type": "text/plain" });
    res.end("Bad Request");
    return;
  }

  const absolutePath = resolve(root, relativePath);
  // Defence in depth: the resolved path must stay within the bundle root even
  // if resolveStaticPath ever let something through.
  if (absolutePath !== root && !absolutePath.startsWith(root + sep)) {
    res.writeHead(403, { "content-type": "text/plain" });
    res.end("Forbidden");
    return;
  }

  const info = await stat(absolutePath).catch(() => null);
  if (!info || !info.isFile()) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not Found");
    return;
  }

  res.writeHead(200, {
    "content-type": contentTypeFor(relativePath),
    "content-length": info.size,
    "cache-control": "no-cache",
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(absolutePath).pipe(res);
}

/**
 * Start an HTTP server for a packed bundle and resolve once it is listening.
 * Rejects if the port is already in use (the caller surfaces a clear message).
 */
export function startBundleServer(options: StartBundleServerOptions): Promise<BundleServerHandle> {
  const host = options.host ?? "localhost";
  const server = createBundleServer(options.rootDir);

  return new Promise<BundleServerHandle>((resolvePromise, reject) => {
    const onError = (error: Error) => reject(error);
    server.once("error", onError);
    server.listen(options.port, host, () => {
      server.removeListener("error", onError);
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : options.port;
      // Wildcard binds are not dialable hostnames; advertise localhost instead.
      const displayHost = host === "0.0.0.0" || host === "::" ? "localhost" : host;
      resolvePromise({
        url: `http://${displayHost}:${port}/`,
        port,
        close: () =>
          new Promise<void>((done, fail) => {
            server.close((err) => (err ? fail(err) : done()));
          }),
      });
    });
  });
}
