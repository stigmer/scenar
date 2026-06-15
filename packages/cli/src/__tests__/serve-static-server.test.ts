import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { request } from "node:http";
import { startBundleServer, type BundleServerHandle } from "../serve/static-server.js";

/**
 * Issue a GET with a verbatim request path. Unlike fetch/URL, node:http does not
 * normalise the path, so an encoded "%2e%2e" traversal reaches the server intact
 * — exactly what an attacker would send. Returns the response status code.
 */
function rawGetStatus(baseUrl: string, rawPath: string): Promise<number> {
  const base = new URL(baseUrl);
  return new Promise<number>((resolvePromise, reject) => {
    const req = request(
      { hostname: base.hostname, port: base.port, path: rawPath, method: "GET" },
      (res) => {
        res.resume();
        resolvePromise(res.statusCode ?? 0);
      },
    );
    req.on("error", reject);
    req.end();
  });
}

describe("startBundleServer", () => {
  let dir: string;
  let server: BundleServerHandle;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "scenar-serve-"));
    await writeFile(join(dir, "index.html"), "<!doctype html><title>tour</title>", "utf-8");
    await mkdir(join(dir, "assets"), { recursive: true });
    await writeFile(join(dir, "assets", "app.js"), "console.log(1)", "utf-8");
    // Port 0 → the OS assigns a free port (no fixed-port collisions in CI).
    server = await startBundleServer({ rootDir: dir, port: 0 });
  });

  afterAll(async () => {
    await server.close();
    await rm(dir, { recursive: true, force: true });
  });

  it("serves index.html at the root with the right content type", async () => {
    const res = await fetch(server.url);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html");
    expect(await res.text()).toContain("<title>tour</title>");
  });

  it("serves nested assets with the right content type", async () => {
    const res = await fetch(new URL("assets/app.js", server.url));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/javascript");
    expect(await res.text()).toBe("console.log(1)");
  });

  it("sets Cache-Control: no-cache so a preview never serves stale assets", async () => {
    const res = await fetch(server.url);
    expect(res.headers.get("cache-control")).toBe("no-cache");
  });

  it("returns 404 for a missing file", async () => {
    const res = await fetch(new URL("does-not-exist.js", server.url));
    expect(res.status).toBe(404);
  });

  it("answers HEAD with headers but no body", async () => {
    const res = await fetch(server.url, { method: "HEAD" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html");
    expect(await res.text()).toBe("");
  });

  it("rejects non-GET/HEAD methods with 405", async () => {
    const res = await fetch(server.url, { method: "POST" });
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET, HEAD");
  });

  it("rejects a raw encoded traversal attempt with 400 (never reaches disk)", async () => {
    // Sent verbatim via node:http so the "%2e%2e" survives to the server.
    expect(await rawGetStatus(server.url, "/%2e%2e/%2e%2e/secret")).toBe(400);
    expect(await rawGetStatus(server.url, "/assets/%2e%2e/%2e%2e/etc/passwd")).toBe(400);
  });
});
