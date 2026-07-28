/**
 * Vite loading + build invocation for `scenar pack`.
 *
 * Vite is loaded dynamically (like the Remotion bundler in `render`) so the CLI
 * stays lean for users who only validate/narrate. The build runs in "app mode"
 * from a generated index.html, producing a self-contained static bundle.
 *
 * The load and the resolution config are exported separately because pack has
 * a second Vite consumer: `collect-pack-shots` SSR-loads the scenario's steps
 * module to record its shot names in scenario.json. Both consumers must
 * resolve the scenario's imports identically — what pack records may never
 * disagree with what the bundle contains — so they share one config source.
 */

/** The subset of Vite's module surface pack uses (typed loosely — Vite is an optional peer). */
interface ViteModule {
  build: (config: Record<string, unknown>) => Promise<unknown>;
  createServer: (config: Record<string, unknown>) => Promise<ViteDevServer>;
}

/** The subset of Vite's dev-server surface `collect-pack-shots` uses. */
export interface ViteDevServer {
  ssrLoadModule: (specifier: string) => Promise<Record<string, unknown>>;
  close: () => Promise<void>;
}

/** Vite + the React plugin factory, dynamically loaded as a pair. */
export interface ViteToolkit {
  readonly vite: ViteModule;
  readonly react: (...args: unknown[]) => unknown;
}

/**
 * Dynamically import Vite and @vitejs/plugin-react, with an actionable
 * install hint when either is missing (they are optional peers).
 */
export async function loadViteToolkit(): Promise<ViteToolkit> {
  const vite = await import("vite").catch((error: unknown) => {
    throw new Error(
      "Could not load vite.\n" +
        "scenar pack bundles the embed with Vite. Install it:\n" +
        "  pnpm add -D vite @vitejs/plugin-react\n" +
        `(import failed with: ${error instanceof Error ? error.message : String(error)})`,
    );
  });

  const reactPluginMod = await import("@vitejs/plugin-react").catch((error: unknown) => {
    throw new Error(
      "Could not load @vitejs/plugin-react.\n" +
        "Install it: pnpm add -D vite @vitejs/plugin-react\n" +
        `(import failed with: ${error instanceof Error ? error.message : String(error)})`,
    );
  });
  const react = (reactPluginMod.default ?? reactPluginMod) as (
    ...args: unknown[]
  ) => unknown;

  return { vite: vite as unknown as ViteModule, react };
}

/**
 * The resolution config shared by the pack build and the pack-time steps
 * load — the parts that decide WHICH files an import specifier reaches.
 */
export function sharedViteConfig(toolkit: ViteToolkit): Record<string, unknown> {
  return {
    configFile: false, // never pick up a vite.config.* from the consumer project.
    logLevel: "warn",
    plugins: [toolkit.react()],
    // A single React copy — the scenario, @scenar/react, and react-dom must agree.
    resolve: { dedupe: ["react", "react-dom"] },
  };
}

export interface ViteBuildInput {
  /** Build root — the temp dir holding index.html + the generated entry. */
  root: string;
  /** Absolute output directory for the static bundle. */
  outDir: string;
  /** Absolute path to the generated index.html (the Rollup input). */
  entryHtmlPath: string;
}

export async function runViteBuild(input: ViteBuildInput): Promise<void> {
  const toolkit = await loadViteToolkit();

  await toolkit.vite.build({
    ...sharedViteConfig(toolkit),
    root: input.root,
    base: "./", // relative asset URLs: the bundle is served from a per-deploy origin root.
    build: {
      outDir: input.outDir,
      emptyOutDir: true,
      cssCodeSplit: false, // one stylesheet, served under style-src 'self'.
      sourcemap: false, // .map is not in the deploy allowlist.
      // Keep Vite's default assetsInlineLimit (4 KiB): small assets inline as data: URIs
      // (allowed by the edge CSP's img-src/font-src 'self' data:), while larger images and
      // fonts emit as hashed files — now first-class members of the deploy allowlist.
      manifest: false, // pack writes its own deploy-facing pack-manifest.json.
      // No inline modulepreload polyfill script — it would violate script-src 'self'.
      modulePreload: { polyfill: false },
      rollupOptions: { input: input.entryHtmlPath },
    },
  });
}
