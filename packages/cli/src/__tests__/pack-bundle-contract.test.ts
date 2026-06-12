import { describe, it, expect } from "vitest";
import {
  ALLOWED_EXTENSIONS,
  CONTENT_TYPE_BY_EXTENSION,
  finalExtension,
  validateRelativePath,
  validateScenarioJson,
  MAX_PATH_DEPTH,
} from "../pack/bundle-contract.js";

describe("bundle-contract: finalExtension", () => {
  it("returns the lowercase final extension", () => {
    expect(finalExtension("index.html")).toBe("html");
    expect(finalExtension("assets/app-ABC123.JS")).toBe("js");
    expect(finalExtension("a/b/c.min.css")).toBe("css");
  });

  it("returns empty string for dotfiles or no extension", () => {
    expect(finalExtension("Makefile")).toBe("");
    expect(finalExtension(".gitignore")).toBe("");
    expect(finalExtension("dir/.keep")).toBe("");
  });
});

describe("bundle-contract: validateRelativePath", () => {
  it("accepts clean allowlisted paths", () => {
    expect(validateRelativePath("index.html")).toBeNull();
    expect(validateRelativePath("assets/index-abc.js")).toBeNull();
    expect(validateRelativePath("assets/index-abc.css")).toBeNull();
    expect(validateRelativePath("scenario.json")).toBeNull();
    expect(validateRelativePath("narration/0.mp3")).toBeNull();
  });

  it("accepts raster images and modern fonts (the Vite asset case)", () => {
    expect(validateRelativePath("assets/logo-abc.png")).toBeNull();
    expect(validateRelativePath("assets/photo-abc.jpg")).toBeNull();
    expect(validateRelativePath("assets/photo-abc.jpeg")).toBeNull();
    expect(validateRelativePath("assets/anim-abc.gif")).toBeNull();
    expect(validateRelativePath("assets/img-abc.webp")).toBeNull();
    expect(validateRelativePath("assets/img-abc.avif")).toBeNull();
    expect(validateRelativePath("assets/font-abc.woff2")).toBeNull();
    expect(validateRelativePath("assets/font-abc.woff")).toBeNull();
  });

  it("normalizes the extension case before the allowlist check", () => {
    expect(validateRelativePath("assets/LOGO-ABC.PNG")).toBeNull();
  });

  it("rejects disallowed extensions (svg active content, source maps, legacy fonts, binaries)", () => {
    expect(validateRelativePath("assets/icon-abc.svg")).toMatch(/disallowed extension/);
    expect(validateRelativePath("assets/app-abc.js.map")).toMatch(/disallowed extension/);
    expect(validateRelativePath("assets/font-abc.ttf")).toMatch(/disallowed extension/);
    expect(validateRelativePath("payload.exe")).toMatch(/disallowed extension/);
  });

  it("rejects unclean paths", () => {
    expect(validateRelativePath("/index.html")).toMatch(/clean relative path/);
    expect(validateRelativePath("a//b.js")).toMatch(/clean relative path/);
  });

  it("rejects traversal segments the charset regex would otherwise admit", () => {
    expect(validateRelativePath("../escape.js")).toMatch(/segments/);
    expect(validateRelativePath("a/../b.js")).toMatch(/segments/);
    expect(validateRelativePath("./a.js")).toMatch(/segments/);
  });

  it("rejects dotfiles with no real extension", () => {
    expect(validateRelativePath("a/b/.js")).toMatch(/disallowed extension/);
  });

  it("rejects paths deeper than the max depth", () => {
    const deep = Array.from({ length: MAX_PATH_DEPTH + 1 }, (_, i) => `d${i}`).join("/") + ".js";
    expect(validateRelativePath(deep)).toMatch(/exceeds the maximum depth/);
  });
});

describe("bundle-contract: validateScenarioJson", () => {
  it("accepts a valid object with a non-empty schemaVersion", () => {
    expect(validateScenarioJson('{"schemaVersion":"1"}')).toBeNull();
    expect(validateScenarioJson('{"schemaVersion":"1","id":"x"}')).toBeNull();
  });

  it("rejects non-objects", () => {
    expect(validateScenarioJson("[]")).toMatch(/must be a JSON object/);
    expect(validateScenarioJson('"x"')).toMatch(/must be a JSON object/);
    expect(validateScenarioJson("null")).toMatch(/must be a JSON object/);
  });

  it("rejects invalid JSON", () => {
    expect(validateScenarioJson("{not json}")).toMatch(/not valid JSON/);
  });

  it("requires a non-empty string schemaVersion", () => {
    expect(validateScenarioJson("{}")).toMatch(/schemaVersion/);
    expect(validateScenarioJson('{"schemaVersion":""}')).toMatch(/schemaVersion/);
    expect(validateScenarioJson('{"schemaVersion":1}')).toMatch(/schemaVersion/);
  });

  it("rejects prototype-pollution keys", () => {
    expect(validateScenarioJson('{"schemaVersion":"1","__proto__":{}}')).toMatch(/forbidden key/);
    expect(validateScenarioJson('{"schemaVersion":"1","prototype":{}}')).toMatch(/forbidden key/);
  });

  it("rejects content over 1 MiB", () => {
    const big = `{"schemaVersion":"1","pad":"${"x".repeat(1024 * 1024)}"}`;
    expect(validateScenarioJson(big)).toMatch(/1 MiB/);
  });
});

describe("bundle-contract: content types", () => {
  it("maps every allowed extension to a type/subtype", () => {
    for (const ext of ALLOWED_EXTENSIONS) {
      const ct = CONTENT_TYPE_BY_EXTENSION[ext];
      expect(ct).toMatch(/^[^\s/]+\/[^\s/]+$/);
    }
  });

  it("maps each extension to its canonical MIME type (lockstep with the backend)", () => {
    expect(CONTENT_TYPE_BY_EXTENSION).toEqual({
      html: "text/html",
      js: "text/javascript",
      css: "text/css",
      json: "application/json",
      mp3: "audio/mpeg",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      avif: "image/avif",
      woff2: "font/woff2",
      woff: "font/woff",
    });
  });
});
