import { describe, expect, it } from "vitest";
import type { StepAction } from "@scenar/core";
import type { InteractionContext } from "../context.js";
import { dispatchHoverEnter, dispatchHoverLeave } from "./hover.js";

function makeCtx(container: HTMLElement): InteractionContext {
  return {
    containerRef: { current: container },
    setCursorTarget: () => {},
    isVideoExport: false,
  };
}

describe("hover effects", () => {
  it("dispatchHoverEnter sets data-hover and dispatches events", () => {
    const container = document.createElement("div");
    const el = document.createElement("div");
    el.setAttribute("data-cursor-target", "item");
    container.appendChild(el);
    document.body.appendChild(container);

    const events: string[] = [];
    el.addEventListener("pointerenter", () => events.push("pointerenter"));
    el.addEventListener("mouseenter", () => events.push("mouseenter"));

    const action: StepAction = { atPercent: 0, type: "hover", target: "item" };
    dispatchHoverEnter(action, makeCtx(container));

    expect(el.getAttribute("data-hover")).toBe("true");
    expect(events).toContain("pointerenter");
    expect(events).toContain("mouseenter");

    container.remove();
  });

  it("dispatchHoverLeave removes data-hover", () => {
    const container = document.createElement("div");
    const el = document.createElement("div");
    el.setAttribute("data-cursor-target", "item");
    el.setAttribute("data-hover", "true");
    container.appendChild(el);
    document.body.appendChild(container);

    const action: StepAction = { atPercent: 0, type: "hover", target: "item" };
    dispatchHoverLeave(action, makeCtx(container));

    expect(el.hasAttribute("data-hover")).toBe(false);

    container.remove();
  });
});
