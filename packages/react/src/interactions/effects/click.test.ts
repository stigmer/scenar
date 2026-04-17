import { describe, expect, it } from "vitest";
import type { StepAction } from "@scenar/core";
import type { InteractionContext } from "../context.js";
import { dispatchClick } from "./click.js";

function makeCtx(container: HTMLElement): InteractionContext {
  return {
    containerRef: { current: container },
    setCursorTarget: () => {},
    isVideoExport: false,
  };
}

describe("dispatchClick", () => {
  it("clicks the matching cursor-target element", () => {
    const container = document.createElement("div");
    const btn = document.createElement("button");
    btn.setAttribute("data-cursor-target", "save");
    container.appendChild(btn);
    document.body.appendChild(container);

    let clicked = false;
    btn.addEventListener("click", () => {
      clicked = true;
    });

    const action: StepAction = { atPercent: 0, type: "click", target: "save" };
    dispatchClick(action, makeCtx(container));
    expect(clicked).toBe(true);

    container.remove();
  });

  it("does nothing when target element is missing", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const action: StepAction = { atPercent: 0, type: "click", target: "nonexistent" };
    dispatchClick(action, makeCtx(container));

    container.remove();
  });
});
