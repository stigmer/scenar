/**
 * Derive a locally-viewable URL from an embed URL. Some local edges serve over
 * http on `*.localhost` even when the URL is emitted as https; for those hosts
 * we downgrade the scheme so the printed link is clickable. Production https
 * URLs and non-URL input are returned unchanged.
 */
export function localViewUrl(embedUrl: string): string {
  try {
    const url = new URL(embedUrl);
    const isLocal =
      url.hostname === "localhost" || url.hostname.endsWith(".localhost");
    if (isLocal && url.protocol === "https:") {
      url.protocol = "http:";
      return url.toString();
    }
  } catch {
    // Not a parseable URL — return as-is.
  }
  return embedUrl;
}
