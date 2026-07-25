import * as fs from "fs";
import * as path from "path";

/**
 * Base dependencies every Scenar demos project needs to author tours. The
 * starter tour is built from `@scenar/react` shells, so `@scenar/react` is
 * recorded as `"*"` (resolves to the latest published — pin it once you know
 * the version you want). React is constrained to the major the `@scenar/*`
 * packages target so the embed and the user's real components (added later)
 * share a single React.
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
 * Creates a minimal `package.json`, a `tsconfig.json` tuned for JSX, a
 * `.gitignore` that ignores build output, and a runnable **starter tour** under
 * `tours/example-tour/` (a `steps.ts` timeline, an `index.tsx` that exports
 * `renderStep`, and a `.scenar/providers.tsx`). The starter is built from
 * `@scenar/react` shells so `scenar pack` works immediately; the author then
 * swaps in their real components and wires data in `providers.tsx`.
 *
 * Existing files are never overwritten — this only fills in what is missing, so
 * it is safe to re-run.
 */
export function scaffoldProject(dir: string): ScaffoldResult {
  const created: string[] = [];

  writeIfMissing(dir, "package.json", renderPackageJson(path.basename(dir)), created);
  writeIfMissing(dir, "tsconfig.json", TSCONFIG, created);
  writeIfMissing(dir, ".gitignore", GITIGNORE, created);
  writeIfMissing(dir, path.join(TOUR_DIR, "steps.ts"), TOUR_STEPS, created);
  writeIfMissing(dir, path.join(TOUR_DIR, "index.tsx"), TOUR_INDEX, created);
  writeIfMissing(dir, path.join(TOUR_DIR, ".scenar", "providers.tsx"), TOUR_PROVIDERS, created);

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
      pack: `scenar pack ${TOUR_DIR}`,
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

/** Where the starter tour is scaffolded (also the default `pack` target). */
const TOUR_DIR = "tours/example-tour";

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
  "include": ["tours"]
}
`;

const GITIGNORE = `node_modules/

# Packed embeds — regenerate with \`scenar pack\`
*-bundle/
`;

const TOUR_STEPS = `import type { ScenarioStep } from "@scenar/core";

/** The screen shown at a given step (maps to a view in index.tsx). */
export type ExampleScreen = "login" | "dashboard";

/** Data snapshot for one step of the tour. */
export interface ExampleStepData {
  /** Address-bar URL shown in the browser chrome (no scheme). */
  readonly url: string;
  /** Which screen is shown at this step. */
  readonly screen: ExampleScreen;
}

/**
 * The tour timeline. \`delayMs\` is the dwell before each step (the first is
 * shown immediately); \`narration\` is the spoken script synthesized by
 * \`scenar narrate\`.
 */
export const steps: ScenarioStep<ExampleStepData>[] = [
  {
    delayMs: 0,
    narration: "Sign in to your workspace.",
    data: { url: "app.example.com/login", screen: "login" },
  },
  {
    delayMs: 2400,
    narration: "And you land on your dashboard.",
    data: { url: "app.example.com/home", screen: "dashboard" },
  },
];
`;

const TOUR_INDEX = `import type { ReactNode } from "react";
import {
  BrowserView,
  DashboardPage,
  LoginCardPage,
  type SideNavItem,
} from "@scenar/react";
import type { ExampleStepData } from "./steps";

/**
 * renderStep: a pure (data, stepIndex) -> ReactNode. Both \`scenar pack\` (embed)
 * and \`scenar render\` (video) consume this contract.
 *
 * This starter draws CSS-only @scenar/react shells so it packs with no extra
 * setup. To show your REAL product UI, install your components
 * (\`scenar install <your-pkg>\`), import and render them here, and wire any data
 * they fetch in .scenar/providers.tsx.
 */
export function renderStep(data: ExampleStepData, stepIndex: number): ReactNode {
  return (
    <BrowserView url={"https://" + data.url} contentKey={String(stepIndex)}>
      {data.screen === "login" ? <LoginScreen /> : <DashboardScreen />}
    </BrowserView>
  );
}

function LoginScreen(): ReactNode {
  return (
    <LoginCardPage
      appName="Example"
      subtitle="Sign in to your workspace"
      fields={[
        { label: "Email", value: "you@example.com", type: "email" },
        { label: "Password", type: "password" },
      ]}
      submitLabel="Sign in"
    />
  );
}

const SIDEBAR: SideNavItem[] = [
  { label: "Workspace", isSection: true },
  { label: "Overview", active: true },
  { label: "Projects" },
];

function DashboardScreen(): ReactNode {
  return (
    <DashboardPage
      appName="Example"
      userName="You"
      navLinks={[{ label: "Home", active: true }]}
      sidebarItems={SIDEBAR}
    >
      <div style={{ padding: 20 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 600,
            color: "var(--scenar-foreground)",
          }}
        >
          Welcome back
        </h2>
      </div>
    </DashboardPage>
  );
}
`;

const TOUR_PROVIDERS = `/**
 * .scenar/providers.tsx — wraps every step of THIS tour in \`scenar pack\` (embed)
 * and \`scenar render\` (video).
 *
 * You only need this when your tour renders real, data-fetching components that
 * need a client/provider to render in isolation (no backend). A tour built only
 * from @scenar/react shells (like the starter) can leave this as a pass-through
 * or delete it.
 *
 * Recommended pattern for Connect-RPC SDKs (e.g. @stigmer/react): mock data with
 * an in-process router transport — no network, no service worker — and resolve
 * the embed's light/dark mode from \`getEmbedColorMode()\`. Fill in your client,
 * provider, and fixtures, then return the provider instead of the fragment:
 *
 *   import "@your-org/react/styles.css";
 *   import { createRouterTransport } from "@connectrpc/connect";
 *   import { getEmbedColorMode } from "@scenar/react";
 *   import { YourClient } from "@your-org/sdk";
 *   import { YourProvider } from "@your-org/react";
 *   import { YourController } from "@your-org/protos/...";
 *
 *   const transport = createRouterTransport((router) => {
 *     router.service(YourController, { get: () => yourFixtureObject });
 *   });
 *   const client = new YourClient({ baseUrl: "/", customTransport: transport });
 *
 *   export function PreviewProviders({ children }: { readonly children: ReactNode }) {
 *     return (
 *       <YourProvider client={client} colorMode={getEmbedColorMode()}>
 *         {children}
 *       </YourProvider>
 *     );
 *   }
 */
import type { ReactNode } from "react";

export function PreviewProviders({ children }: { readonly children: ReactNode }) {
  return <>{children}</>;
}
`;
