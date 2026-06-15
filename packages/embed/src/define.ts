/**
 * Side-effecting entry: importing `@scenar/embed/define` registers the
 * `<scenar-embed>` custom element. For bundler hosts that want the tag available
 * without calling {@link defineScenarEmbed} themselves.
 */
import { defineScenarEmbed } from "./element.js";

defineScenarEmbed();
