import { describe, expect, it } from "vitest";
import { DEFAULT_VIEWPORT, resolvePackViewport } from "../pack/viewport.js";

const AUTHORED = { width: 1440, height: 900 };

describe("resolvePackViewport", () => {
  it("explicit options win over the authored viewport", () => {
    expect(resolvePackViewport({ width: 1280, shellHeight: 800 }, AUTHORED)).toEqual({
      width: 1280,
      height: 800,
      source: "explicit",
    });
  });

  it("the authored viewport wins over the default", () => {
    expect(resolvePackViewport({}, AUTHORED)).toEqual({
      width: 1440,
      height: 900,
      source: "authored",
    });
  });

  it("falls back to the packer default when nothing is specified", () => {
    expect(resolvePackViewport({}, null)).toEqual({
      width: DEFAULT_VIEWPORT.width,
      height: DEFAULT_VIEWPORT.height,
      source: "default",
    });
  });

  it("a partial explicit override fills the other axis from the authored viewport", () => {
    expect(resolvePackViewport({ width: 1600 }, AUTHORED)).toEqual({
      width: 1600,
      height: 900,
      source: "explicit",
    });
  });

  it("a partial explicit override without an authored viewport fills from the default", () => {
    expect(resolvePackViewport({ shellHeight: 1000 }, null)).toEqual({
      width: DEFAULT_VIEWPORT.width,
      height: 1000,
      source: "explicit",
    });
  });
});
