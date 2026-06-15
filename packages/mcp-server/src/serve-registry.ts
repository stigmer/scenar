import type { BundleServerHandle } from "@scenar/cli/api";

/**
 * Tracks preview servers started by the `scenar_serve` tool so they outlive a
 * single tool call (the AI starts one, then keeps working) and can be listed or
 * stopped. Keyed by the served URL. The server process owns these; they are all
 * closed on shutdown.
 */
const servers = new Map<string, BundleServerHandle>();

export function rememberServer(handle: BundleServerHandle): void {
  servers.set(handle.url, handle);
}

export function listServers(): string[] {
  return [...servers.keys()];
}

/** Stop a server by URL. Returns true if one was running and is now stopped. */
export async function stopServer(url: string): Promise<boolean> {
  const handle = servers.get(url);
  if (!handle) return false;
  await handle.close();
  servers.delete(url);
  return true;
}

/** Stop every running server (called on process shutdown). */
export async function stopAllServers(): Promise<void> {
  const handles = [...servers.values()];
  servers.clear();
  await Promise.all(handles.map((h) => h.close().catch(() => {})));
}
