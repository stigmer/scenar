// @scenar/embed — public API
// Drop-in host-side embedding for hosted Scenar tours. Importing this entry has
// no side effects (it does not register the element); call `defineScenarEmbed()`
// or import `@scenar/embed/define` to register `<scenar-embed>`.

// Custom element + registrar
export { ScenarEmbedElement, defineScenarEmbed, SCENAR_EMBED_TAG } from "./element.js";

// Framework-free mount (the shared core both adapters build on)
export { createEmbedMount } from "./mount.js";
export type { EmbedMount, EmbedMountOptions, EmbedAspectRatio } from "./mount.js";

// Pure resolution helpers + baseline constants
export {
  resolveEmbedSrc,
  resolveTheme,
  applyThemeToSrc,
  originFromSrc,
  EMBED_BASE_ASPECT_WIDTH,
  EMBED_BASE_ASPECT_HEIGHT,
} from "./resolve.js";
export type { ScenarEmbedTheme, EmbedSource } from "./resolve.js";

// The embed event/command types for host consumers (re-exported from @scenar/core)
export type { ScenarEmbedEvent, ScenarEmbedCommand } from "@scenar/core";
