import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanProject } from "../scan.js";
import type { ScanResult } from "../types.js";
import { renderReport } from "../../generator/templates/report.js";
import { renderViewsGenerated } from "../../generator/templates/views-generated.js";

/**
 * Builds a throwaway Next.js-shaped project on disk and scans it. These tests
 * pin the scanner regressions found while validating against a real app:
 * double-counted default exports, undeduped skips, unresolved name collisions,
 * and UI primitives flooding the registry.
 */
describe("scanProject", () => {
  let root: string;
  let result: ScanResult;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "scenar-scan-"));

    writeFileSync(
      join(root, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { jsx: "react-jsx", strict: true } }),
    );

    const write = (rel: string, body: string) => {
      const abs = join(root, rel);
      mkdirSync(join(abs, ".."), { recursive: true });
      writeFileSync(abs, body);
    };

    // A redirect-only page: default-exported function, no JSX → skipped ONCE.
    write(
      "src/app/page.tsx",
      `export default function HomePage() { return undefined as any; }`,
    );

    // Distinct, well-named route.
    write(
      "src/app/dashboard/page.tsx",
      `export default function DashboardRoute() { return <div>dash</div>; }`,
    );

    // Two dynamic detail routes both default-export `Page` → name collision.
    write(
      "src/app/library/agents/[org]/[slug]/page.tsx",
      `export default function Page() { return <div>agent</div>; }`,
    );
    write(
      "src/app/library/mcp-servers/[org]/[slug]/page.tsx",
      `export default function Page() { return <div>mcp</div>; }`,
    );

    // Two named-export collisions in different folders → aliased on import.
    write("src/widgets/alpha/Thing.tsx", `export function Thing() { return <i>a</i>; }`);
    write("src/widgets/beta/Thing.tsx", `export function Thing() { return <i>b</i>; }`);

    // A UI primitive → excluded from the registry, surfaced separately.
    write("src/domain/_shared/ui/button.tsx", `export function Button() { return <button />; }`);

    result = scanProject(root, { sourceRoots: ["src"] });
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("counts a redirect-only default export as skipped exactly once", () => {
    const homePageSkips = result.skipped.filter((s) => s.name === "HomePage");
    expect(homePageSkips).toHaveLength(1);
    expect(homePageSkips[0]!.reason).toBe("no-jsx-return");
    expect(result.discovered.some((c) => c.name === "HomePage")).toBe(false);
  });

  it("excludes UI primitives from the registry and reports them separately", () => {
    expect(result.discovered.some((c) => c.name === "Button")).toBe(false);
    const primitiveSkip = result.skipped.find((s) => s.name === "Button");
    expect(primitiveSkip?.reason).toBe("ui-primitive");
  });

  it("resolves name collisions with unique, path-qualified keys", () => {
    const keys = result.discovered.map((c) => c.name);
    expect(new Set(keys).size).toBe(keys.length); // all keys unique

    const pageViews = result.discovered.filter((c) => c.exportName === "Page");
    expect(pageViews).toHaveLength(2);
    // One keeps the bare name; the other is qualified by its route segment.
    expect(pageViews.map((c) => c.name).sort()).toEqual(
      ["McpServersPage", "Page"].sort(),
    );

    const things = result.discovered.filter((c) => c.exportName === "Thing");
    expect(things).toHaveLength(2);
    expect(new Set(things.map((c) => c.name)).size).toBe(2);
  });

  it("aliases on import when a named export's key was disambiguated", () => {
    const generated = renderViewsGenerated(result, join(root, ".scenar"));
    const aliasedThing = result.discovered.find(
      (c) => c.exportName === "Thing" && c.name !== "Thing",
    );
    expect(aliasedThing).toBeDefined();
    expect(generated).toContain(`{ Thing as ${aliasedThing!.name} }`);
    // The bare `Thing` is imported without an alias.
    expect(generated).toMatch(/import \{ Thing \} from/);
  });

  it("renders a report with a single valid example, primitives split out", () => {
    const report = renderReport(result);

    expect(report).toContain("## UI primitives");

    // Button lives in the primitives section, not the skipped table.
    const skippedSection = report.slice(
      report.indexOf("## Skipped"),
      report.indexOf("## UI primitives"),
    );
    expect(skippedSection).not.toContain("Button");

    // Exactly one customViews example import — never a duplicate-laden dump.
    const importLines = report.split("\n").filter((l) => l.startsWith("import {"));
    expect(importLines).toHaveLength(1);
    const customKeys = report.match(/export const customViews = \{\n {2}(\w+),/);
    expect(customKeys).not.toBeNull();
  });
});
