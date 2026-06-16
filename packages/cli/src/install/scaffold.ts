import * as fs from "fs";
import * as path from "path";

/**
 * Base dependencies every Scenar demos project needs to author tours against
 * real components. `@scenar/react` is written as `"*"` and pinned to the
 * installed version after the package-manager install (see `run-install.ts`);
 * React is pinned to the major the `@scenar/*` packages target so the embed and
 * the user's components share one React.
 */
export const BASE_DEPENDENCIES: Readonly<Record<string, string>> = {
  "@scenar/react": "*",
  react: "^19.0.0",
  "react-dom": "^19.0.0",
};

/** Result of scaffolding a fresh demos project. */
export interface ScaffoldResult {
  /** Files created, relative to the project directory. */
  readonly created: readonly string[];
}

/**
 * Scaffold a fresh Scenar demos project in `dir`.
 *
 * Creates a minimal `package.json`, a starter view (so the first scan finds
 * something and the author has a shape to copy), a `tsconfig.json` tuned for
 * JSX scanning, and a `.gitignore` that ignores build output and the generated
 * registry. Existing files are never overwritten — this only fills in what is
 * missing, so it is safe to re-run.
 */
export function scaffoldProject(dir: string): ScaffoldResult {
  const created: string[] = [];

  writeIfMissing(dir, "package.json", renderPackageJson(path.basename(dir)), created);
  writeIfMissing(dir, "tsconfig.json", TSCONFIG, created);
  writeIfMissing(dir, ".gitignore", GITIGNORE, created);
  writeIfMissing(
    dir,
    path.join("src", "views", "WelcomeView.tsx"),
    WELCOME_VIEW,
    created,
  );

  return { created };
}

function writeIfMissing(
  dir: string,
  relPath: string,
  content: string,
  created: string[],
): void {
  const target = path.join(dir, relPath);
  if (fs.existsSync(target)) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf-8");
  created.push(relPath);
}

function renderPackageJson(name: string): string {
  const pkg = {
    name: toPackageName(name),
    version: "0.0.0",
    private: true,
    type: "module",
    scripts: {
      refresh: "scenar install",
      pack: "scenar pack",
    },
    dependencies: { ...BASE_DEPENDENCIES },
  };
  return JSON.stringify(pkg, null, 2) + "\n";
}

/** Coerce a directory name into a valid npm package name. */
function toPackageName(dirName: string): string {
  const slug = dirName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "scenar-demos";
}

const TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src"]
}
`;

const GITIGNORE = `node_modules/

# Packed embeds — regenerate with \`scenar pack\`
*-bundle/

# Auto-generated view registry — recreated by \`scenar install\`
.scenar/views.generated.ts
`;

const WELCOME_VIEW = `/**
 * Starter view for your Scenar demos project.
 *
 * Author your tour screens here as ordinary React components — compose your
 * real product components (installed as dependencies, e.g. \`@stigmer/react\`)
 * into the screens you want to narrate. Re-run \`scenar install\` to refresh the
 * generated registry, then build a tour with the Scenar skill.
 */
export function WelcomeView() {
  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        fontFamily: "system-ui, sans-serif",
        textAlign: "center",
        padding: 32,
      }}
    >
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
        Your first Scenar view
      </h1>
      <p style={{ maxWidth: 420, color: "#555", margin: 0 }}>
        Edit <code>src/views</code> to compose your real components, then ask the
        AI to build a tour.
      </p>
    </div>
  );
}
`;
