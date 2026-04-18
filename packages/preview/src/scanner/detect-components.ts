import {
  type SourceFile,
  type FunctionDeclaration,
  type VariableDeclaration,
  type Type,
  type Symbol as TsSymbol,
  SyntaxKind,
  Node,
} from "ts-morph";
import type {
  DiscoveredComponent,
  SkippedComponent,
  PropInfo,
  ComponentCategory,
} from "./types.js";

const PASCAL_CASE_RE = /^[A-Z][a-zA-Z0-9]*$/;
const HOOK_RE = /^use[A-Z]/;

const SERVER_ONLY_MODULES = new Set([
  "fs",
  "fs/promises",
  "path",
  "child_process",
  "crypto",
  "net",
  "os",
  "stream",
  "worker_threads",
  "dns",
  "tls",
  "http",
  "https",
  "http2",
  "cluster",
  "dgram",
  "readline",
  "repl",
  "tty",
  "v8",
  "vm",
  "zlib",
  "perf_hooks",
  "async_hooks",
  "server-only",
  "next/headers",
  "next/cookies",
]);

interface DetectionResult {
  readonly discovered: DiscoveredComponent[];
  readonly skipped: SkippedComponent[];
}

/**
 * Analyse a single source file and extract React component exports.
 *
 * @param sourceFile  ts-morph SourceFile already part of the project.
 * @param projectRoot Absolute path to the project root (for relative import paths).
 */
export function detectComponents(
  sourceFile: SourceFile,
  projectRoot: string,
): DetectionResult {
  const discovered: DiscoveredComponent[] = [];
  const skipped: SkippedComponent[] = [];
  const filePath = sourceFile.getFilePath();

  if (isServerComponent(sourceFile)) {
    for (const name of collectExportedNames(sourceFile)) {
      skipped.push({ name, filePath, reason: "server-component" });
    }
    return { discovered, skipped };
  }

  if (hasServerOnlyImport(sourceFile)) {
    for (const name of collectExportedNames(sourceFile)) {
      skipped.push({ name, filePath, reason: "server-only-import" });
    }
    return { discovered, skipped };
  }

  for (const fn of sourceFile.getFunctions()) {
    if (!fn.isExported()) continue;
    processFunction(fn, fn.getName() ?? "default", sourceFile, filePath, projectRoot, discovered, skipped);
  }

  for (const varStmt of sourceFile.getVariableStatements()) {
    if (!varStmt.isExported()) continue;
    for (const decl of varStmt.getDeclarations()) {
      processVariable(decl, sourceFile, filePath, projectRoot, discovered, skipped);
    }
  }

  const defaultExportSymbol = sourceFile.getDefaultExportSymbol();
  if (defaultExportSymbol && !discovered.some(c => c.exportType === "default")) {
    processDefaultExport(defaultExportSymbol, sourceFile, filePath, projectRoot, discovered, skipped);
  }

  return { discovered, skipped };
}

// ---------------------------------------------------------------------------
// Function declarations
// ---------------------------------------------------------------------------

function processFunction(
  fn: FunctionDeclaration,
  name: string,
  _sourceFile: SourceFile,
  filePath: string,
  projectRoot: string,
  discovered: DiscoveredComponent[],
  skipped: SkippedComponent[],
): void {
  if (!name || !PASCAL_CASE_RE.test(name)) return;

  if (HOOK_RE.test(name)) {
    skipped.push({ name, filePath, reason: "hook" });
    return;
  }

  if (!returnsJsx(fn)) {
    skipped.push({ name, filePath, reason: "no-jsx-return" });
    return;
  }

  const props = extractProps(fn.getParameters()[0]?.getType());
  const importPath = buildImportPath(filePath, projectRoot);
  const isDefault = fn.isDefaultExport();

  discovered.push({
    name,
    importPath,
    filePath,
    exportType: isDefault ? "default" : "named",
    props,
    usesContext: bodyCallsUseContext(fn),
    category: categoriseFile(filePath),
  });
}

// ---------------------------------------------------------------------------
// Variable declarations (arrow functions, React.FC)
// ---------------------------------------------------------------------------

function processVariable(
  decl: VariableDeclaration,
  _sourceFile: SourceFile,
  filePath: string,
  projectRoot: string,
  discovered: DiscoveredComponent[],
  skipped: SkippedComponent[],
): void {
  const name = decl.getName();
  if (!PASCAL_CASE_RE.test(name)) return;

  if (HOOK_RE.test(name)) {
    skipped.push({ name, filePath, reason: "hook" });
    return;
  }

  const init = decl.getInitializer();
  if (!init) return;

  if (Node.isArrowFunction(init) || Node.isFunctionExpression(init)) {
    if (!returnsJsx(init)) {
      skipped.push({ name, filePath, reason: "no-jsx-return" });
      return;
    }

    const props = extractProps(init.getParameters()[0]?.getType());
    const importPath = buildImportPath(filePath, projectRoot);

    discovered.push({
      name,
      importPath,
      filePath,
      exportType: "named",
      props,
      usesContext: bodyCallsUseContext(init),
      category: categoriseFile(filePath),
    });
    return;
  }

  if (Node.isCallExpression(init)) {
    const callName = init.getExpression().getText();
    if (callName === "React.memo" || callName === "memo" || callName === "React.forwardRef" || callName === "forwardRef") {
      const arg = init.getArguments()[0];
      if (arg && (Node.isArrowFunction(arg) || Node.isFunctionExpression(arg))) {
        if (!returnsJsx(arg)) return;
        const props = extractProps(arg.getParameters()[0]?.getType());
        const importPath = buildImportPath(filePath, projectRoot);
        discovered.push({
          name,
          importPath,
          filePath,
          exportType: "named",
          props,
          usesContext: bodyCallsUseContext(arg),
          category: categoriseFile(filePath),
        });
      }
    } else {
      skipped.push({ name, filePath, reason: "higher-order-component" });
    }
  }
}

// ---------------------------------------------------------------------------
// Default exports that are not direct function declarations
// ---------------------------------------------------------------------------

function processDefaultExport(
  sym: TsSymbol,
  _sourceFile: SourceFile,
  filePath: string,
  projectRoot: string,
  discovered: DiscoveredComponent[],
  skipped: SkippedComponent[],
): void {
  const declarations = sym.getDeclarations();
  if (declarations.length === 0) return;

  const decl = declarations[0]!;
  if (Node.isFunctionDeclaration(decl)) {
    const name = decl.getName() ?? fileNameToComponentName(filePath);
    processFunction(decl, name, decl.getSourceFile(), filePath, projectRoot, discovered, skipped);
    return;
  }

  if (Node.isExportAssignment(decl)) {
    const expr = decl.getExpression();
    if (Node.isIdentifier(expr)) {
      const name = expr.getText();
      if (PASCAL_CASE_RE.test(name) && !discovered.some(c => c.name === name)) {
        // Already handled as a named export — skip duplicate
      }
    }
  }
}

// ---------------------------------------------------------------------------
// JSX return detection
// ---------------------------------------------------------------------------

function returnsJsx(node: Node): boolean {
  const returnType = tryGetReturnType(node);
  if (returnType) {
    const text = returnType.getText();
    if (
      text.includes("JSX.Element") ||
      text.includes("ReactElement") ||
      text.includes("ReactNode") ||
      text === "Element" ||
      text.includes("React.JSX.Element")
    ) {
      return true;
    }
  }

  let foundJsx = false;
  node.forEachDescendant((child) => {
    if (foundJsx) return;
    if (
      child.getKind() === SyntaxKind.JsxElement ||
      child.getKind() === SyntaxKind.JsxSelfClosingElement ||
      child.getKind() === SyntaxKind.JsxFragment
    ) {
      foundJsx = true;
    }
  });
  return foundJsx;
}

function tryGetReturnType(node: Node): Type | undefined {
  try {
    if (Node.isFunctionDeclaration(node) || Node.isArrowFunction(node) || Node.isFunctionExpression(node)) {
      return node.getReturnType();
    }
  } catch {
    // Type inference can fail on complex expressions
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Props extraction
// ---------------------------------------------------------------------------

function extractProps(type: Type | undefined): PropInfo[] {
  if (!type) return [];

  const props: PropInfo[] = [];
  for (const prop of type.getProperties()) {
    const name = prop.getName();
    if (name.startsWith("_") || name === "children" || name === "key" || name === "ref") continue;

    const propDecl = prop.getDeclarations()[0];
    let typeText = "unknown";
    try {
      if (propDecl) {
        const propType = propDecl.getType?.() ?? prop.getTypeAtLocation(propDecl);
        typeText = propType.getText(propDecl);
        if (typeText.length > 80) {
          typeText = typeText.slice(0, 77) + "...";
        }
      }
    } catch {
      // Fallback for complex/unresolvable types
    }

    const isOptional = prop.isOptional();
    props.push({ name, type: typeText, required: !isOptional });
  }

  return props;
}

// ---------------------------------------------------------------------------
// useContext detection
// ---------------------------------------------------------------------------

function bodyCallsUseContext(node: Node): boolean {
  let found = false;
  node.forEachDescendant((child) => {
    if (found) return;
    if (Node.isCallExpression(child)) {
      const expr = child.getExpression();
      const text = expr.getText();
      if (text === "useContext" || text === "React.useContext") {
        found = true;
      }
    }
  });
  return found;
}

// ---------------------------------------------------------------------------
// Server component / server-only detection
// ---------------------------------------------------------------------------

function isServerComponent(sourceFile: SourceFile): boolean {
  const fullText = sourceFile.getFullText();
  const firstLine = fullText.trimStart().split("\n")[0]?.trim() ?? "";
  return firstLine === '"use server"' || firstLine === "'use server'";
}

function hasServerOnlyImport(sourceFile: SourceFile): boolean {
  for (const imp of sourceFile.getImportDeclarations()) {
    const specifier = imp.getModuleSpecifierValue();
    if (SERVER_ONLY_MODULES.has(specifier)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collectExportedNames(sourceFile: SourceFile): string[] {
  const names: string[] = [];
  for (const fn of sourceFile.getFunctions()) {
    if (fn.isExported() && fn.getName()) names.push(fn.getName()!);
  }
  for (const varStmt of sourceFile.getVariableStatements()) {
    if (!varStmt.isExported()) continue;
    for (const decl of varStmt.getDeclarations()) {
      names.push(decl.getName());
    }
  }
  if (names.length === 0) {
    names.push(fileNameToComponentName(sourceFile.getFilePath()));
  }
  return names;
}

function fileNameToComponentName(filePath: string): string {
  const base = filePath.split("/").pop() ?? "Component";
  const name = base.replace(/\.(tsx?|jsx?)$/, "");
  if (name === "index") {
    const dir = filePath.split("/").at(-2) ?? "Component";
    return toPascalCase(dir);
  }
  return toPascalCase(name);
}

function toPascalCase(s: string): string {
  return s
    .replace(/[-_.]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, (_, c: string) => c.toUpperCase());
}

function buildImportPath(filePath: string, projectRoot: string): string {
  let rel = filePath.startsWith(projectRoot)
    ? filePath.slice(projectRoot.length)
    : filePath;
  if (rel.startsWith("/")) rel = rel.slice(1);
  rel = rel.replace(/\.(tsx?|jsx?)$/, "");
  return rel;
}

function categoriseFile(filePath: string): ComponentCategory {
  const lower = filePath.toLowerCase();
  if (lower.includes("/pages/") || lower.includes("/app/") && lower.includes("page.")) return "page";
  if (lower.includes("/layout") || lower.includes("/shell")) return "layout";
  if (
    lower.includes("/ui/") ||
    lower.includes("/primitives/") ||
    lower.includes("/atoms/")
  ) return "primitive";
  return "component";
}
