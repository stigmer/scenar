import { afterEach, describe, expect, it } from "vitest";
import { getEmbedColorMode } from "./index.js";

/**
 * `getEmbedColorMode` reads the embed's own URL (`?theme=dark`). In jsdom we
 * drive `window.location.search` via `history.replaceState`.
 */
describe("getEmbedColorMode", () => {
  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("defaults to light with no theme param", () => {
    window.history.replaceState({}, "", "/");
    expect(getEmbedColorMode()).toBe("light");
  });

  it("returns dark for ?theme=dark", () => {
    window.history.replaceState({}, "", "/?theme=dark");
    expect(getEmbedColorMode()).toBe("dark");
  });

  it("returns light for any other theme value", () => {
    window.history.replaceState({}, "", "/?theme=light");
    expect(getEmbedColorMode()).toBe("light");

    window.history.replaceState({}, "", "/?theme=solarized");
    expect(getEmbedColorMode()).toBe("light");
  });

  it("ignores unrelated query params", () => {
    window.history.replaceState({}, "", "/?autoplay=1&speed=2");
    expect(getEmbedColorMode()).toBe("light");
  });
});
