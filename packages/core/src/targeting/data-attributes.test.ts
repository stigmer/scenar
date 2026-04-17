import { describe, expect, it } from "vitest";
import {
  CURSOR_TARGET_ATTRIBUTE,
  SCROLL_TARGET_ATTRIBUTE,
  cursorTargetSelector,
  scrollTargetSelector,
} from "./data-attributes.js";

describe("data-attributes", () => {
  it("exports correct attribute names", () => {
    expect(CURSOR_TARGET_ATTRIBUTE).toBe("data-cursor-target");
    expect(SCROLL_TARGET_ATTRIBUTE).toBe("data-scroll-target");
  });

  it("builds correct cursor target selectors", () => {
    expect(cursorTargetSelector("submit-btn")).toBe('[data-cursor-target="submit-btn"]');
  });

  it("builds correct scroll target selectors", () => {
    expect(scrollTargetSelector("results")).toBe('[data-scroll-target="results"]');
  });
});
