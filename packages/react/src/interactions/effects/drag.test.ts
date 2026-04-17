import { describe, expect, it } from "vitest";
import type { StepAction } from "@scenar/core";
import type { InteractionContext } from "../context.js";
import { dispatchDragPress, dispatchDragRelease } from "./drag.js";

function makeCtx(container: HTMLElement): InteractionContext {
  return {
    containerRef: { current: container },
    setCursorTarget: () => {},
    isVideoExport: false,
  };
}

describe("drag effects", () => {
  it("dispatchDragPress sets data-dragging and dispatches pointerdown", () => {
    const container = document.createElement("div");
    const el = document.createElement("div");
    el.setAttribute("data-cursor-target", "card");
    container.appendChild(el);
    document.body.appendChild(container);

    let pDown = false;
    el.addEventListener("pointerdown", () => {
      pDown = true;
    });

    const action: StepAction = { atPercent: 0, type: "drag", target: "card", dragTarget: "slot" };
    dispatchDragPress(action, makeCtx(container));

    expect(pDown).toBe(true);
    expect(el.getAttribute("data-dragging")).toBe("true");

    container.remove();
  });

  it("dispatchDragRelease removes data-dragging from source", () => {
    const container = document.createElement("div");
    const src = document.createElement("div");
    src.setAttribute("data-cursor-target", "card");
    src.setAttribute("data-dragging", "true");
    const dest = document.createElement("div");
    dest.setAttribute("data-cursor-target", "slot");
    container.appendChild(src);
    container.appendChild(dest);
    document.body.appendChild(container);

    const action: StepAction = { atPercent: 0, type: "drag", target: "card", dragTarget: "slot" };
    dispatchDragRelease(action, makeCtx(container));

    expect(src.hasAttribute("data-dragging")).toBe(false);

    container.remove();
  });
});
