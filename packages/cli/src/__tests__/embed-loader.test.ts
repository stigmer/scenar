import { describe, it, expect } from "vitest";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyEmbedLoader, EMBED_LOADER_FILE } from "../pack/embed-loader.js";

describe("copyEmbedLoader", () => {
  it("copies @scenar/embed's loader into the bundle as embed.js (idempotent)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "scenar-loader-"));
    try {
      await copyEmbedLoader(dir);

      const dest = join(dir, EMBED_LOADER_FILE);
      const info = await stat(dest);
      expect(info.isFile()).toBe(true);
      expect(info.size).toBeGreaterThan(0);

      // It is the IIFE loader that registers the custom element.
      const js = await readFile(dest, "utf-8");
      expect(js).toContain("scenar-embed");

      // Copying again overwrites cleanly (same bytes) — pack can re-run safely.
      await copyEmbedLoader(dir);
      expect(await readFile(dest, "utf-8")).toBe(js);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
