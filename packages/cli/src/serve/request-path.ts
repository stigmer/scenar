import { CONTENT_TYPE_BY_EXTENSION, finalExtension } from "../pack/bundle-contract.js";

/** File served for a directory request ("/" or any path ending in "/"). */
export const INDEX_FILE = "index.html";

/** Content type for an extension the bundle contract does not recognise. */
export const DEFAULT_CONTENT_TYPE = "application/octet-stream";

/**
 * Resolve an incoming request URL path to a clean, bundle-relative file path —
 * or null if the request is malformed or attempts to escape the bundle root.
 *
 * Pure: no filesystem access. The caller maps the returned relative path onto
 * disk (and 404s if the file is absent). This is the security-critical core of
 * the local server, so it is isolated and exhaustively unit-tested:
 *   - percent-decoding (rejecting malformed encodings),
 *   - directory requests mapped to {@link INDEX_FILE},
 *   - rejection of "", ".", ".." segments and backslash/NUL injection.
 *
 * A defence-in-depth absolute-path containment check still runs in the server
 * after this resolves, but this function alone must never yield a traversing
 * path.
 */
export function resolveStaticPath(urlPath: string): string | null {
  // Keep only the path; drop any query string or fragment defensively.
  const pathOnly = urlPath.split(/[?#]/, 1)[0] ?? "";

  let decoded: string;
  try {
    decoded = decodeURIComponent(pathOnly);
  } catch {
    return null; // malformed percent-encoding
  }

  // Requests are absolute-path form; reject separator/NUL injection outright.
  if (!decoded.startsWith("/")) return null;
  if (decoded.includes("\0") || decoded.includes("\\")) return null;

  // A directory request ("/" or trailing slash) serves the index document.
  const withIndex = decoded === "/" || decoded.endsWith("/") ? decoded + INDEX_FILE : decoded;

  const segments = withIndex.replace(/^\/+/, "").split("/");
  for (const segment of segments) {
    // Empty (double-slash), current-dir, and parent-dir segments are all
    // rejected: the charset is otherwise permissive and "." is a valid char.
    if (segment === "" || segment === "." || segment === "..") return null;
  }
  return segments.join("/");
}

/** Canonical content type for a bundle file path, keyed on its final extension. */
export function contentTypeFor(relativePath: string): string {
  const ext = finalExtension(relativePath) as keyof typeof CONTENT_TYPE_BY_EXTENSION;
  return CONTENT_TYPE_BY_EXTENSION[ext] ?? DEFAULT_CONTENT_TYPE;
}
