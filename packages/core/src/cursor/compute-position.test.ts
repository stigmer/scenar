import { describe, expect, it } from "vitest";
import { computeCursorPosition } from "./compute-position.js";

function mockContainer(rect: DOMRect, offsetWidth: number): HTMLElement {
  return {
    getBoundingClientRect: () => rect,
    offsetWidth,
  } as unknown as HTMLElement;
}

function mockElement(rect: DOMRect): Element {
  return {
    getBoundingClientRect: () => rect,
  } as unknown as Element;
}

describe("computeCursorPosition", () => {
  it("computes center position relative to container without zoom", () => {
    const container = mockContainer(new DOMRect(100, 50, 800, 600), 800);
    const el = mockElement(new DOMRect(300, 200, 40, 20));

    const pos = computeCursorPosition(container, el);
    expect(pos.x).toBe(300 - 100 + 20); // (left - containerLeft + width/2) / zoom
    expect(pos.y).toBe(200 - 50 + 10);
  });

  it("accounts for CSS zoom", () => {
    // Container renders at 2x CSS zoom: 400px offsetWidth but 800px client width
    const container = mockContainer(new DOMRect(0, 0, 800, 600), 400);
    const el = mockElement(new DOMRect(200, 100, 40, 20));

    const pos = computeCursorPosition(container, el);
    const zoom = 800 / 400; // 2x
    expect(pos.x).toBe((200 + 20) / zoom);
    expect(pos.y).toBe((100 + 10) / zoom);
  });

  it("returns origin when element is at container top-left with zero size", () => {
    const container = mockContainer(new DOMRect(0, 0, 800, 600), 800);
    const el = mockElement(new DOMRect(0, 0, 0, 0));

    const pos = computeCursorPosition(container, el);
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(0);
  });
});
