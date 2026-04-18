import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { resolvePublicDir, initMswServiceWorker } from "../msw-init.js";

describe("resolvePublicDir", () => {
  it("returns public/ for nextjs", () => {
    expect(resolvePublicDir("/app", "nextjs")).toBe("/app/public");
  });

  it("returns public/ for vite", () => {
    expect(resolvePublicDir("/app", "vite")).toBe("/app/public");
  });

  it("returns public/ for cra", () => {
    expect(resolvePublicDir("/app", "cra")).toBe("/app/public");
  });

  it("returns public/ for remix", () => {
    expect(resolvePublicDir("/app", "remix")).toBe("/app/public");
  });

  it("returns public/ for unknown frameworks", () => {
    expect(resolvePublicDir("/app", "unknown")).toBe("/app/public");
  });
});

describe("initMswServiceWorker", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scenar-msw-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates the public directory and service worker when they don't exist", () => {
    const result = initMswServiceWorker(tmpDir, "nextjs");

    expect(result.status).toBe("created");
    expect(result.path).toBeTruthy();
    expect(fs.existsSync(result.path!)).toBe(true);

    const content = fs.readFileSync(result.path!, "utf-8");
    expect(content).toContain("Mock Service Worker");
  });

  it("preserves existing service worker file", () => {
    const publicDir = path.join(tmpDir, "public");
    fs.mkdirSync(publicDir, { recursive: true });

    const workerPath = path.join(publicDir, "mockServiceWorker.js");
    fs.writeFileSync(workerPath, "// existing worker", "utf-8");

    const result = initMswServiceWorker(tmpDir, "nextjs");

    expect(result.status).toBe("exists");
    expect(fs.readFileSync(workerPath, "utf-8")).toBe("// existing worker");
  });

  it("writes to framework-appropriate public directory", () => {
    const result = initMswServiceWorker(tmpDir, "vite");

    expect(result.path).toBe(
      path.join(tmpDir, "public", "mockServiceWorker.js"),
    );
  });
});
