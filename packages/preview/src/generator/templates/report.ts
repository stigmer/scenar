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
      lines.push(`| ${comp.name} | ${comp.importPath} | ${comp.category} | ${propsStr} |`);
    }
  } else {
    lines.push(`_No components discovered. Check your \`scenar.config.ts\` source roots._`);
  }

  lines.push(``);

  // --- Skipped ---
  lines.push(`## Skipped (${scanResult.skipped.length} components)`);
  lines.push(``);

  if (scanResult.skipped.length > 0) {
    lines.push(`| Component | Path | Reason |`);
    lines.push(`|-----------|------|--------|`);
    for (const comp of scanResult.skipped) {
      lines.push(`| ${comp.name} | ${comp.filePath} | ${formatReason(comp)} |`);
    }
  } else {
    lines.push(`_All exported components were successfully discovered._`);
  }

  lines.push(``);

  // --- Adding skipped components ---
  if (scanResult.skipped.length > 0) {
    lines.push(`## Adding skipped components`);
    lines.push(``);
    lines.push(`Edit \`.scenar/views.custom.tsx\` to add them manually:`);
    lines.push(``);
    lines.push("```tsx");
    for (const comp of scanResult.skipped) {
      lines.push(`import { ${comp.name} } from "../${relativeFromSkipped(comp)}";`);
    }
    lines.push(``);
    lines.push(`export const customViews = {`);
    for (const comp of scanResult.skipped) {
      lines.push(`  ${comp.name},`);
    }
    lines.push(`} as const;`);
    lines.push("```");
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
