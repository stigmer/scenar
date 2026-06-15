/**
 * The IIFE entry, bundled to `dist/embed.global.js` (see vite.config.ts) — the
 * single pasteable `<script>` for no-bundler hosts. It auto-registers
 * `<scenar-embed>` on load and also exposes the registrar on `window.ScenarEmbed`
 * for hosts that register under a custom tag.
 */
import { ScenarEmbedElement, defineScenarEmbed } from "./element.js";

defineScenarEmbed();

export { ScenarEmbedElement, defineScenarEmbed };
