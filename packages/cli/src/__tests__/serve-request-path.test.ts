import { describe, it, expect } from "vitest";
import { resolveStaticPath, contentTypeFor } from "../serve/request-path.js";

describe("resolveStaticPath", () => {
  it("maps the root and trailing-slash paths to index.html", () => {
    expect(resolveStaticPath("/")).toBe("index.html");
    expect(resolveStaticPath("/sub/")).toBe("sub/index.html");
  });

  it("returns clean relative paths for file requests", () => {
    expect(resolveStaticPath("/assets/index-abc.js")).toBe("assets/index-abc.js");
    expect(resolveStaticPath("/scenario.json")).toBe("scenario.json");
    expect(resolveStaticPath("/narration/step-0.mp3")).toBe("narration/step-0.mp3");
  });

  it("strips a query string and fragment", () => {
    expect(resolveStaticPath("/assets/app.js?v=2")).toBe("assets/app.js");
    expect(resolveStaticPath("/index.html#top")).toBe("index.html");
  });

  it("percent-decodes path segments", () => {
    expect(resolveStaticPath("/assets/logo%20art.png")).toBe("assets/logo art.png");
  });

  it("rejects parent-directory traversal in every form", () => {
    expect(resolveStaticPath("/../secret")).toBeNull();
    expect(resolveStaticPath("/assets/../../etc/passwd")).toBeNull();
    expect(resolveStaticPath("/%2e%2e/secret")).toBeNull();
    expect(resolveStaticPath("/foo/%2e%2e/%2e%2e/bar")).toBeNull();
  });

  it("rejects current-dir and empty (double-slash) segments", () => {
    expect(resolveStaticPath("/./foo")).toBeNull();
    expect(resolveStaticPath("/foo//bar")).toBeNull();
  });

  it("rejects backslash and NUL injection", () => {
    expect(resolveStaticPath("/..\\windows")).toBeNull();
    expect(resolveStaticPath("/foo\u0000.js")).toBeNull();
  });

  it("rejects malformed percent-encoding", () => {
    expect(resolveStaticPath("/%zz")).toBeNull();
  });

  it("rejects non-absolute paths", () => {
    expect(resolveStaticPath("relative")).toBeNull();
    expect(resolveStaticPath("")).toBeNull();
  });
});

describe("contentTypeFor", () => {
  it("resolves canonical bundle content types by extension", () => {
    expect(contentTypeFor("index.html")).toBe("text/html");
    expect(contentTypeFor("assets/app.js")).toBe("text/javascript");
    expect(contentTypeFor("assets/style.css")).toBe("text/css");
    expect(contentTypeFor("scenario.json")).toBe("application/json");
    expect(contentTypeFor("narration/step-0.mp3")).toBe("audio/mpeg");
    expect(contentTypeFor("assets/logo.png")).toBe("image/png");
    expect(contentTypeFor("fonts/inter.woff2")).toBe("font/woff2");
  });

  it("falls back to application/octet-stream for unknown extensions", () => {
    expect(contentTypeFor("data.bin")).toBe("application/octet-stream");
    expect(contentTypeFor("noext")).toBe("application/octet-stream");
  });
});
