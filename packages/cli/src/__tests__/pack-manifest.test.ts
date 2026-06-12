import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  buildPackManifest,
  writeScenarioJson,
  writePackManifest,
  PACK_MANIFEST_FILE,
} from "../pack/pack-manifest.js";
import {
  RELATIVE_PATH_PATTERN,
  SHA256_HEX_PATTERN,
  CONTENT_TYPE_PATTERN,
  ALLOWED_EXTENSIONS,
  MAX_PATH_DEPTH,
  finalExtension,
} from "../pack/bundle-contract.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "scenar-pack-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** Write a minimal, allowlist-clean bundle into `dir`. */
async function seedCleanBundle(): Promise<void> {
  await writeFile(join(dir, "index.html"), "<!doctype html><div id=root></div>", "utf-8");
  await mkdir(join(dir, "assets"), { recursive: true });
  await writeFile(join(dir, "assets", "index-abc123.js"), "console.log(1)", "utf-8");
  await writeFile(join(dir, "assets", "index-abc123.css"), ".x{}", "utf-8");
}

describe("writeScenarioJson", () => {
  it("writes a valid scenario.json at the bundle root", async () => {
    await writeScenarioJson(dir, "welcome-tour", "0.0.1");
    const raw = await readFile(join(dir, "scenario.json"), "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.schemaVersion).toBe("1");
    expect(parsed.id).toBe("welcome-tour");
    expect(parsed.generator).toContain("@scenar/cli pack");
  });
});

describe("buildPackManifest", () => {
  it("computes one validated entry per file with lowercase-hex sha256", async () => {
    await seedCleanBundle();
    await writeScenarioJson(dir, "welcome-tour", "0.0.1");

    const manifest = await buildPackManifest(dir, "welcome-tour");

    expect(manifest.scenarioId).toBe("welcome-tour");
    const paths = manifest.files.map((f) => f.path);
    expect(paths).toContain("index.html");
    expect(paths).toContain("assets/index-abc123.js");
    expect(paths).toContain("assets/index-abc123.css");
    expect(paths).toContain("scenario.json");

    // sha256 is the real lowercase-hex digest of the bytes.
    const js = manifest.files.find((f) => f.path === "assets/index-abc123.js")!;
    const expected = createHash("sha256").update("console.log(1)").digest("hex");
    expect(js.sha256).toBe(expected);
    expect(js.contentType).toBe("text/javascript");
    expect(js.sizeBytes).toBe(Buffer.byteLength("console.log(1)"));
  });

  it("never lists pack-manifest.json itself", async () => {
    await seedCleanBundle();
    await writeScenarioJson(dir, "welcome-tour", "0.0.1");
    const manifest = await buildPackManifest(dir, "welcome-tour");
    await writePackManifest(dir, manifest);
    // Re-derive after the manifest file exists on disk.
    const manifest2 = await buildPackManifest(dir, "welcome-tour");
    expect(manifest2.files.map((f) => f.path)).not.toContain(PACK_MANIFEST_FILE);
  });

  it("rejects a bundle with a disallowed extension (image/font case)", async () => {
    await seedCleanBundle();
    await writeFile(join(dir, "assets", "logo-abc.png"), "binary", "utf-8");
    await expect(buildPackManifest(dir, "welcome-tour")).rejects.toThrow(/allowlist/);
  });
});

/**
 * The anti-drift anchor: every file pack emits must satisfy the exact rules the
 * backend enforces (DeployManifestValidator + CompleteDeployUploadSessionHandler
 * + ScenarioJsonValidator). If the backend tightens a rule, this test must be
 * updated in lockstep with bundle-contract.ts.
 */
describe("bundle-contract conformance (pack output ↔ backend validators)", () => {
  it("produces a manifest every field of which the backend would accept", async () => {
    await seedCleanBundle();
    await writeScenarioJson(dir, "welcome-tour", "0.0.1");
    const manifest = await buildPackManifest(dir, "welcome-tour");

    // scenario.json is present at the root (REQUIRED_FILE).
    expect(manifest.files.some((f) => f.path === "scenario.json")).toBe(true);

    const seen = new Set<string>();
    for (const file of manifest.files) {
      // Clean relative path, bounded depth.
      expect(file.path).toMatch(RELATIVE_PATH_PATTERN);
      expect(file.path.split("/").length).toBeLessThanOrEqual(MAX_PATH_DEPTH);
      // Allowlisted final extension.
      expect(ALLOWED_EXTENSIONS as readonly string[]).toContain(finalExtension(file.path));
      // Lowercase-hex sha256, exactly 64 chars.
      expect(file.sha256).toMatch(SHA256_HEX_PATTERN);
      // Positive size.
      expect(file.sizeBytes).toBeGreaterThan(0);
      // type/subtype content type.
      expect(file.contentType).toMatch(CONTENT_TYPE_PATTERN);
      // No duplicate paths.
      expect(seen.has(file.path)).toBe(false);
      seen.add(file.path);
    }
  });
});
