import { describe, it, expect } from "vitest";
import {
  applyThemeToSrc,
  originFromSrc,
  resolveEmbedSrc,
  resolveTheme,
} from "./resolve.js";

describe("resolveEmbedSrc", () => {
  it("returns an explicit src verbatim", () => {
    expect(resolveEmbedSrc({ src: "https://e.example/tour/" })).toBe("https://e.example/tour/");
  });

  it("prefers src over id+base when both are given", () => {
    expect(
      resolveEmbedSrc({ src: "https://e.example/a/", id: "b", base: "https://e.example" }),
    ).toBe("https://e.example/a/");
  });

  it("joins base + id with a single trailing slash (base without slash)", () => {
    expect(resolveEmbedSrc({ id: "welcome", base: "https://e.example/demos" })).toBe(
      "https://e.example/demos/welcome/",
    );
  });

  it("joins base + id without doubling the slash (base with slash)", () => {
    expect(resolveEmbedSrc({ id: "welcome", base: "https://e.example/demos/" })).toBe(
      "https://e.example/demos/welcome/",
    );
  });

  it("throws an actionable error when neither src nor id+base is provided", () => {
    expect(() => resolveEmbedSrc({})).toThrowError(/provide `src`, or both `id` and `base`/);
    expect(() => resolveEmbedSrc({ id: "welcome" })).toThrowError(/id` and `base`/);
  });
});

describe("resolveTheme", () => {
  it("pins light and dark regardless of host state", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("light", false)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("dark", true)).toBe("dark");
  });

  it("defers to the host's resolved state under auto", () => {
    expect(resolveTheme("auto", true)).toBe("dark");
    expect(resolveTheme("auto", false)).toBe("light");
  });
});

describe("applyThemeToSrc", () => {
  it("adds the theme query when absent", () => {
    expect(applyThemeToSrc("https://e.example/tour/", "dark")).toBe(
      "https://e.example/tour/?theme=dark",
    );
  });

  it("replaces an existing theme query rather than appending", () => {
    expect(applyThemeToSrc("https://e.example/tour/?theme=dark", "light")).toBe(
      "https://e.example/tour/?theme=light",
    );
  });

  it("preserves other query params", () => {
    expect(applyThemeToSrc("https://e.example/tour/?a=1", "dark")).toBe(
      "https://e.example/tour/?a=1&theme=dark",
    );
  });
});

describe("originFromSrc", () => {
  it("returns scheme + host + port with no path", () => {
    expect(originFromSrc("https://e.example/tour/?theme=dark")).toBe("https://e.example");
    expect(originFromSrc("http://localhost:4173/")).toBe("http://localhost:4173");
  });
});
