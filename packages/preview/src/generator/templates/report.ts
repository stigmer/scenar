import type { ScanResult, DiscoveredComponent, SkippedComponent } from "../../scanner/types.js";

/**
 * Render `report.md` — the scan diagnostic.
 * Overwritten on every scan.
 */
export function renderReport(scanResult: ScanResult): string {
  const now = new Date().toISOString();
  const lines: string[] = [];

  lines.push(`# Scenar Preview Report`);
  lines.push(`Generated: ${now}`);
  lines.push(``);

  // --- Discovered ---
  lines.push(`## Discovered (${scanResult.discovered.length} components) → views.generated.ts`);
  lines.push(``);

  if (scanResult.discovered.length > 0) {
    lines.push(`| Component | Path | Category | Props |`);
    lines.push(`|-----------|------|----------|-------|`);
    for (const comp of scanResult.discovered) {
      const propsStr = formatProps(comp);
      const label =
        comp.name === comp.exportName
          ? comp.name
          : `${comp.name} _(exports \`${comp.exportName}\`)_`;
      lines.push(`| ${label} | ${comp.importPath} | ${comp.category} | ${propsStr} |`);
    }
  } else {
    lines.push(`_No components discovered. Check your \`scenar.config.ts\` source roots._`);
  }

  lines.push(``);

  // Split UI primitives out of the skipped list — they're excluded by design,
  // not failures, and shouldn't be lumped in with HOCs/hooks/server components.
  const primitives = scanResult.skipped.filter((c) => c.reason === "ui-primitive");
  const skipped = scanResult.skipped.filter((c) => c.reason !== "ui-primitive");

  // --- Skipped ---
  lines.push(`## Skipped (${skipped.length} components)`);
  lines.push(``);

  if (skipped.length > 0) {
    lines.push(`| Component | Path | Reason |`);
    lines.push(`|-----------|------|--------|`);
    for (const comp of skipped) {
      lines.push(`| ${comp.name} | ${comp.filePath} | ${formatReason(comp)} |`);
    }
  } else {
    lines.push(`_No components were skipped._`);
  }

  lines.push(``);

  // --- UI primitives (excluded by default) ---
  if (primitives.length > 0) {
    lines.push(`## UI primitives (${primitives.length}, excluded by default)`);
    lines.push(``);
    lines.push(
      `These look like leaf UI primitives (\`ui/\`, \`primitives/\`, \`atoms/\`), ` +
        `so they're kept out of the registry. Most scenarios compose pages, not ` +
        `primitives — but you can opt one in via \`views.custom.tsx\` if needed.`,
    );
    lines.push(``);
    lines.push(`| Component | Path |`);
    lines.push(`|-----------|------|`);
    for (const comp of primitives) {
      lines.push(`| ${comp.name} | ${comp.filePath} |`);
    }
    lines.push(``);
  }

  // --- Adding a component manually ---
  const addable = [...skipped, ...primitives];
  if (addable.length > 0) {
    const example = addable[0]!;
    lines.push(`## Adding a component manually`);
    lines.push(``);
    lines.push(
      `Edit \`.scenar/views.custom.tsx\` to register a skipped component or ` +
        `primitive. For example:`,
    );
    lines.push(``);
    lines.push("```tsx");
    lines.push(`import { ${example.name} } from "../${relativeFromSkipped(example)}";`);
    lines.push(``);
    lines.push(`export const customViews = {`);
    lines.push(`  ${example.name},`);
    lines.push(`} as const;`);
    lines.push("```");
    lines.push(``);
    lines.push(
      `Note: server components, hooks, and redirect-only pages can't be rendered ` +
        `as views as-is — adapt them into a presentational component first.`,
    );
    lines.push(``);
  }

  // --- Metadata ---
  lines.push(`## Scan metadata`);
  lines.push(``);
  lines.push(`- **Framework:** ${scanResult.framework}`);
  lines.push(`- **Entry point:** ${scanResult.entryPoint ?? "not detected"}`);
  if (scanResult.detectedProviders.length > 0) {
    lines.push(`- **Detected providers:** ${scanResult.detectedProviders.join(", ")}`);
  }
  lines.push(``);

  return lines.join("\n");
}

function formatProps(comp: DiscoveredComponent): string {
  if (comp.props.length === 0) return "_none_";
  const parts = comp.props.slice(0, 5).map(
    (p) => `${p.name}${p.required ? "" : "?"}:${'\u00A0'}${p.type}`,
  );
  if (comp.props.length > 5) parts.push(`+${comp.props.length - 5} more`);
  return parts.join(", ");
}

function formatReason(comp: SkippedComponent): string {
  switch (comp.reason) {
    case "server-component": return "Server Component (RSC)";
    case "server-only-import": return "Imports server-only module";
    case "dynamic-import": return "Dynamic import (React.lazy)";
    case "higher-order-component": return "Higher-order component";
    case "hook": return "Hook (use* prefix)";
    case "no-jsx-return": return "No JSX return detected";
    case "no-default-or-named-export": return "No usable export";
    case "ui-primitive": return "UI primitive (excluded)";
  }
}

function relativeFromSkipped(comp: SkippedComponent): string {
  const parts = comp.filePath.split("/");
  const srcIdx = parts.findIndex((p) => p === "src");
  if (srcIdx >= 0) {
    return parts.slice(srcIdx).join("/").replace(/\.(tsx?|jsx?)$/, "");
  }
  return comp.filePath.replace(/\.(tsx?|jsx?)$/, "");
}
