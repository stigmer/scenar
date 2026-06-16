import { createHash } from "node:crypto";
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import {
  CONTENT_TYPE_BY_EXTENSION,
  finalExtension,
  validateRelativePath,
  validateScenarioJson,
} from "./bundle-contract.js";
import type { Viewport } from "./viewport.js";

/** One uploadable file, described exactly as the deploy session needs it. */
export interface PackFile {
  /** Bundle-relative POSIX path (e.g. "assets/index-abc.js"). */
  readonly path: string;
  /** Lowercase-hex SHA-256 of the bytes (64 chars). */
  readonly sha256: string;
  /** Byte length (> 0). */
  readonly sizeBytes: number;
  /** Content type the server binds into the presign and the edge serves. */
  readonly contentType: string;
}

/** The deploy instruction file the upload backend consumes. */
export interface PackManifest {
  readonly schemaVersion: number;
  readonly scenarioId: string;
  /** Files to upload — excludes the manifest itself. */
  readonly files: PackFile[];
}

/** Name of the manifest file written at the bundle root (not itself uploaded). */
export const PACK_MANIFEST_FILE = "pack-manifest.json";

/** Name of the required scenario descriptor at the bundle root. */
export const SCENARIO_JSON_FILE = "scenario.json";

/**
 * Write the bundle's scenario.json — the required-at-root descriptor. Kept
 * intentionally minimal (a validated metadata header) plus the canonical
 * `viewport` baked into the bundle: the player reads its steps from the bundled
 * JS, so the full serialized spec is still a follow-up, but `deploy` needs the
 * viewport to derive a correctly-proportioned embed snippet (DD-004). The
 * viewport mirrors `ViewportConfig { width, height }`. Validated against the
 * backend rules before writing (which accept the extra `viewport` key).
 */
export async function writeScenarioJson(
  outDir: string,
  scenarioId: string,
  generatorVersion: string,
  viewport: Viewport,
): Promise<void> {
  const content = JSON.stringify(
    {
      schemaVersion: "1",
      id: scenarioId,
      generator: `@scenar/cli pack ${generatorVersion}`,
      viewport: { width: viewport.width, height: viewport.height },
    },
    null,
    2,
  );
  const error = validateScenarioJson(content);
  if (error) {
    throw new Error(`Generated scenario.json is invalid: ${error}`);
  }
  await writeFile(join(outDir, SCENARIO_JSON_FILE), content, "utf-8");
}

/**
 * Walk the build output and produce the pack manifest: one validated entry per
 * file (excluding the manifest itself), with a lowercase-hex SHA-256, byte size,
 * and content type. Throws with a clear message if any file violates the bundle
 * contract (e.g. a disallowed extension), so the failure is local and obvious.
 */
export async function buildPackManifest(outDir: string, scenarioId: string): Promise<PackManifest> {
  const absPaths = await walkFiles(outDir);
  const files: PackFile[] = [];

  for (const abs of absPaths) {
    const rel = toPosix(relative(outDir, abs));
    if (rel === PACK_MANIFEST_FILE) {
      continue; // the manifest never lists itself.
    }

    const pathError = validateRelativePath(rel);
    if (pathError) {
      throw new Error(
        `Bundle contains a file that the deploy allowlist would reject:\n  ${pathError}\n\n` +
          "The deploy allowlist covers HTML/JS/CSS/JSON, MP3 narration, raster images\n" +
          "(png/jpg/jpeg/gif/webp/avif), and woff2/woff fonts. SVG is not a served type:\n" +
          "inline it as a React component or a data URI rather than emitting an .svg file.",
      );
    }

    const bytes = await readFile(abs);
    files.push({
      path: rel,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      sizeBytes: bytes.length,
      contentType: CONTENT_TYPE_BY_EXTENSION[finalExtension(rel) as keyof typeof CONTENT_TYPE_BY_EXTENSION],
    });
  }

  files.sort((a, b) => a.path.localeCompare(b.path));
  return { schemaVersion: 1, scenarioId, files };
}

/** Write pack-manifest.json at the bundle root. */
export async function writePackManifest(outDir: string, manifest: PackManifest): Promise<void> {
  await writeFile(
    join(outDir, PACK_MANIFEST_FILE),
    JSON.stringify(manifest, null, 2),
    "utf-8",
  );
}

/** Recursively collect absolute file paths under a directory. */
async function walkFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkFiles(abs)));
    } else if (entry.isFile()) {
      out.push(abs);
    }
  }
  return out;
}

/** True if every listed file exists on disk under outDir with the recorded size. */
export async function verifyManifestFilesExist(outDir: string, manifest: PackManifest): Promise<void> {
  for (const file of manifest.files) {
    const abs = join(outDir, ...file.path.split("/"));
    const info = await stat(abs).catch(() => null);
    if (!info || !info.isFile()) {
      throw new Error(`pack-manifest lists a missing file: ${file.path}`);
    }
  }
}

function toPosix(p: string): string {
  return sep === "/" ? p : p.split(sep).join("/");
}
