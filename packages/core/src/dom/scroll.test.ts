import { describe, expect, it } from "vitest";
import { findScrollParent } from "./scroll.js";

describe("findScrollParent", () => {
  it("returns null when no scrollable ancestor exists", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    expect(findScrollParent(el)).toBe(null);
    el.remove();
  });

  it("finds the nearest scrollable ancestor", () => {
    const scrollable = document.createElement("div");
    scrollable.style.overflowY = "auto";
    const child = document.createElement("div");
    scrollable.appendChild(child);
    document.body.appendChild(scrollable);

    expect(findScrollParent(child)).toBe(scrollable);
    scrollable.remove();
  });

  it("skips non-scrollable intermediaries", () => {
    const scrollable = document.createElement("div");
    scrollable.style.overflowY = "scroll";
    const middle = document.createElement("div");
    const child = document.createElement("div");
    scrollable.appendChild(middle);
    middle.appendChild(child);
    document.body.appendChild(scrollable);

    expect(findScrollParent(child)).toBe(scrollable);
    scrollable.remove();
  });
});
