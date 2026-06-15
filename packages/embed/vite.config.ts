import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Builds the single, self-contained `<script>` artifact `dist/embed.global.js`
 * — the paste-only / no-bundler delivery of the loader. It is an IIFE that
 * auto-registers the `<scenar-embed>` custom element on load.
 *
 * Everything is inlined, including `@scenar/core`'s embed host controller, so a
 * host page needs nothing but this one tag. The global never imports React (the
 * web component is framework-free); the React wrapper ships ESM-only via the
 * `@scenar/embed/react` subpath, built by `tsc` alongside the other entries.
 *
 * `emptyOutDir: false` is load-bearing: `tsc --build` runs first and emits the
 * ESM entries + declarations into `dist/`; this pass only adds the global, and
 * must not wipe them.
 */
export default defineConfig({
  build: {
    emptyOutDir: false,
    minify: true,
    sourcemap: false,
    lib: {
      entry: resolve(here, "src/global.ts"),
      formats: ["iife"],
      name: "ScenarEmbed",
      fileName: () => "embed.global.js",
    },
    rollupOptions: {
      // The global is a standalone <script>: inline every dependency (including
      // @scenar/core) so no bare import survives into the browser bundle.
      external: () => false,
    },
  },
});
