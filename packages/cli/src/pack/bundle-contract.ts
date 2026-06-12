/**
 * The bundle contract — the exact rules the Scenar Cloud backend enforces when
 * it accepts a deploy. `scenar pack` validates its own output against these
 * rules so a malformed bundle fails locally with a clear message rather than
 * mid-upload, and a conformance test asserts pack output satisfies them so pack
 * and the server can never drift.
 *
 * Source of truth (kept in lockstep):
 *   - DeployManifestValidator.java  — extensions, path pattern, depth, dupes
 *   - CompleteDeployUploadSessionHandler.java — sha256/size/content-type shape
 *   - ScenarioJsonValidator.java    — scenario.json rules
 */

/** Final-extension allowlist (lowercase, no dot). Matches the backend exactly. */
export const ALLOWED_EXTENSIONS = ["html", "js", "css", "json", "mp3"] as const;

/** Conventional content type per allowed extension. */
export const CONTENT_TYPE_BY_EXTENSION: Record<(typeof ALLOWED_EXTENSIONS)[number], string> = {
  html: "text/html",
  js: "text/javascript",
  css: "text/css",
  json: "application/json",
  mp3: "audio/mpeg",
};

/** A bundle-relative path: clean POSIX segments, no leading/trailing/double slash. */
export const RELATIVE_PATH_PATTERN = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;

/** Maximum number of path segments (directory depth) the backend allows. */
export const MAX_PATH_DEPTH = 12;

/** Lowercase hex SHA-256 (exactly 64 chars) — the form the presign binds. */
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** A `type/subtype` content type — the minimal shape the backend requires. */
export const CONTENT_TYPE_PATTERN = /^[^\s/]+\/[^\s/]+$/;

/** The file every bundle must contain at its root. */
export const REQUIRED_FILE = "scenario.json";

/** Keys forbidden in scenario.json to block prototype-pollution payloads. */
const FORBIDDEN_JSON_KEYS = ["__proto__", "constructor", "prototype"];

/** scenario.json must be at most 1 MiB. */
const MAX_SCENARIO_JSON_BYTES = 1024 * 1024;

/** Returns the lowercase final extension of a path (no dot), or "" if none. */
export function finalExtension(path: string): string {
  const base = path.slice(path.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  return dot <= 0 ? "" : base.slice(dot + 1).toLowerCase();
}

/**
 * Validate one bundle-relative file path against the backend rules. Returns an
 * error message, or null if the path is acceptable.
 */
export function validateRelativePath(path: string): string | null {
  if (!RELATIVE_PATH_PATTERN.test(path)) {
    return `path "${path}" is not a clean relative path (allowed: A-Z a-z 0-9 . _ - and /)`;
  }
  const segments = path.split("/");
  if (segments.length > MAX_PATH_DEPTH) {
    return `path "${path}" exceeds the maximum depth of ${MAX_PATH_DEPTH}`;
  }
  // The charset regex still admits "." and ".." segments (the dot is allowed);
  // the backend rejects them as traversal, so we must too.
  for (const segment of segments) {
    if (segment === "." || segment === "..") {
      return `path "${path}" must not contain "." or ".." segments`;
    }
  }
  const ext = finalExtension(path);
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    return `file "${path}" has a disallowed extension; allowed: ${ALLOWED_EXTENSIONS.join(", ")}`;
  }
  return null;
}

/**
 * Validate the parsed scenario.json content. Returns an error message, or null
 * if it satisfies the backend's ScenarioJsonValidator rules.
 */
export function validateScenarioJson(raw: string): string | null {
  if (Buffer.byteLength(raw, "utf-8") > MAX_SCENARIO_JSON_BYTES) {
    return "scenario.json exceeds the 1 MiB limit";
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return "scenario.json is not valid JSON";
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return "scenario.json must be a JSON object";
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.schemaVersion !== "string" || obj.schemaVersion.length === 0) {
    return 'scenario.json must have a non-empty string "schemaVersion"';
  }
  for (const key of FORBIDDEN_JSON_KEYS) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      return `scenario.json must not contain the forbidden key "${key}"`;
    }
  }
  return null;
}
