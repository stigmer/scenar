/**
 * Vite build invocation for `scenar pack`.
 *
 * Vite is loaded dynamically (like the Remotion bundler in `render`) so the CLI
 * stays lean for users who only validate/narrate. The build runs in "app mode"
 * from a generated index.html, producing a self-contained static bundle.
 */

export interface ViteBuildInput {
  /** Build root — the temp dir holding index.html + the generated entry. */
  root: string;
  /** Absolute output directory for the static bundle. */
  outDir: string;
  /** Absolute path to the generated index.html (the Rollup input). */
  entryHtmlPath: string;
}

export async function runViteBuild(input: ViteBuildInput): Promise<void> {
  const vite = await import("vite").catch(() => {
    throw new Error(
      "Could not load vite.\n" +
        "scenar pack bundles the embed with Vite. Install it:\n" +
        "  pnpm add -D vite @vitejs/plugin-react",
    );
  });

  const reactPluginMod = await import("@vitejs/plugin-react").catch(() => {
    throw new Error(
      "Could not load @vitejs/plugin-react.\n" +
        "Install it: pnpm add -D vite @vitejs/plugin-react",
    );
  });
  const react = (reactPluginMod.default ?? reactPluginMod) as (
    ...args: unknown[]
  ) => unknown;

  await (vite.build as (config: Record<string, unknown>) => Promise<unknown>)({
    root: input.root,
    base: "./", // relative asset URLs: the bundle is served from a per-deploy origin root.
    configFile: false, // never pick up a vite.config.* from the consumer project.
    logLevel: "warn",
    plugins: [react()],
    // A single React copy — the scenario, @scenar/react, and react-dom must agree.
    resolve: { dedupe: ["react", "react-dom"] },
    build: {
      outDir: input.outDir,
      emptyOutDir: true,
      cssCodeSplit: false, // one stylesheet, served under style-src 'self'.
      sourcemap: false, // .map is not in the deploy allowlist.
      manifest: false, // pack writes its own deploy-facing pack-manifest.json.
      // No inline modulepreload polyfill script — it would violate script-src 'self'.
      modulePreload: { polyfill: false },
      rollupOptions: { input: input.entryHtmlPath },
    },
  });
}
