import * as fs from "fs";
import * as path from "path";

/** Marker that delimits the install-owned section appended to report.md. */
const SECTION_MARKER = "## Component packages";

/**
 * Append a "Component packages" section to `.scenar/report.md` listing the
 * dependencies you added, their resolved versions, and their import entry
 * points. This is a discovery aid for the author/AI — *not* a registry: these
 * packages are composed into the local views you write, never auto-registered.
 *
 * Idempotent: re-running replaces the section rather than duplicating it.
 */
export function appendPackageReport(
  outputDir: string,
  projectDir: string,
  packageNames: readonly string[],
): void {
  if (packageNames.length === 0) return;

  const reportPath = path.join(outputDir, "report.md");
  if (!fs.existsSync(reportPath)) return;

  const nodeModules = path.join(projectDir, "node_modules");
  const entries = unique(packageNames).map((name) =>
    describePackage(nodeModules, name),
  );

  if (entries.length === 0) return;

  const section = renderSection(entries);
  const existing = fs.readFileSync(reportPath, "utf-8");
  const stripped = stripSection(existing);
  const joined = `${stripped.replace(/\s+$/, "")}\n\n${section}\n`;
  fs.writeFileSync(reportPath, joined, "utf-8");
}

interface PackageDescription {
  readonly name: string;
  readonly version: string | null;
  readonly description: string | null;
  readonly entryPoints: readonly string[];
}

/**
 * Describe a package for the report. Reads rich detail (version, description,
 * entry points) from the installed copy when present; otherwise falls back to a
 * name-only entry so the aid still lists what was requested before an install.
 */
function describePackage(nodeModules: string, name: string): PackageDescription {
  const fallback: PackageDescription = {
    name,
    version: null,
    description: null,
    entryPoints: [name],
  };

  const pkgPath = path.join(nodeModules, name, "package.json");
  if (!fs.existsSync(pkgPath)) return fallback;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as Record<string, any>;
    return {
      name,
      version: typeof pkg.version === "string" ? pkg.version : null,
      description: typeof pkg.description === "string" ? pkg.description : null,
      entryPoints: entryPointsFrom(name, pkg.exports),
    };
  } catch {
    return fallback;
  }
}

/** Turn an `exports` map into importable specifiers (e.g. `@foo/bar/styles.css`). */
function entryPointsFrom(name: string, exportsField: unknown): string[] {
  if (!exportsField || typeof exportsField !== "object") return [name];
  const keys = Object.keys(exportsField as Record<string, unknown>);
  const subpaths = keys.filter((k) => k.startsWith("."));
  if (subpaths.length === 0) return [name];
  return subpaths.map((k) =>
    k === "." ? name : `${name}/${k.replace(/^\.\//, "")}`,
  );
}

function renderSection(entries: readonly PackageDescription[]): string {
  const lines = [
    SECTION_MARKER,
    "",
    "Real component packages installed as dependencies. Compose these into the",
    "views you author under `src/` — they are intentionally **not** added to the",
    "generated registry. See each package's own types/docs for its exports.",
    "",
  ];
  for (const entry of entries) {
    const version = entry.version ? `@${entry.version}` : "";
    lines.push(`- **${entry.name}${version}**`);
    if (entry.description) lines.push(`  - ${entry.description}`);
    lines.push(`  - import from: ${entry.entryPoints.map((e) => `\`${e}\``).join(", ")}`);
  }
  return lines.join("\n");
}

/** Remove a previously appended section (marker through end of file). */
function stripSection(content: string): string {
  const index = content.indexOf(SECTION_MARKER);
  return index === -1 ? content : content.slice(0, index);
}

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}
