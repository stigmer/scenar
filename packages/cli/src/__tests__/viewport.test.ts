import { describe, it, expect } from "vitest";
import { parseViewport, DEFAULT_VIEWPORT } from "../pack/viewport.js";

describe("parseViewport", () => {
  it("accepts a well-formed viewport object", () => {
    expect(parseViewport({ width: 896, height: 480 })).toEqual({ width: 896, height: 480 });
  });

  it("ignores extra keys, keeping only width/height", () => {
    expect(parseViewport({ width: 800, height: 600, depth: 1 })).toEqual({
      width: 800,
      height: 600,
    });
  });

  it.each([
    ["null", null],
    ["a string", "896x480"],
    ["an array", [896, 480]],
    ["missing height", { width: 896 }],
    ["zero width", { width: 0, height: 480 }],
    ["negative height", { width: 896, height: -1 }],
    ["non-integer", { width: 896.5, height: 480 }],
    ["non-numeric", { width: "896", height: "480" }],
    ["NaN", { width: Number.NaN, height: 480 }],
  ])("returns null for %s", (_label, value) => {
    expect(parseViewport(value)).toBeNull();
  });

  it("exposes sane defaults", () => {
    expect(DEFAULT_VIEWPORT).toEqual({ width: 896, height: 480 });
  });
});
