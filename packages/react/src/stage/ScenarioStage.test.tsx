import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, within } from "@testing-library/react";
import { ScenarioStage } from "./ScenarioStage.js";

afterEach(cleanup);

describe("ScenarioStage", () => {
  it("renders children inside the framed window", () => {
    const { container } = render(
      <ScenarioStage>
        <p>content</p>
      </ScenarioStage>,
    );
    expect(within(container).getByText("content")).toBeDefined();
  });

  it("paints the backdrop and insets from the stage tokens", () => {
    const { container } = render(
      <ScenarioStage>
        <p>content</p>
      </ScenarioStage>,
    );
    const stage = container.firstElementChild as HTMLElement;
    expect(stage.style.background).toContain("--scenar-backdrop");
    expect(stage.style.padding).toBe("36px 48px");
  });

  it("hands the window a shell height derived from the inherited one, minus insets", () => {
    const { container } = render(
      <ScenarioStage insetY={40}>
        <p>content</p>
      </ScenarioStage>,
    );
    const stage = container.firstElementChild as HTMLElement;
    const windowEl = stage.firstElementChild as HTMLElement;
    // The indirection: stage derives, window re-declares from the derivation.
    expect(stage.style.getPropertyValue("--scenar-stage-window-height")).toBe(
      "calc(var(--scenar-shell-height, 100%) - 80px)",
    );
    expect(windowEl.style.getPropertyValue("--scenar-shell-height")).toBe(
      "var(--scenar-stage-window-height)",
    );
  });

  it("frames the window with the radius and shadow tokens and clips it", () => {
    const { container } = render(
      <ScenarioStage>
        <p>content</p>
      </ScenarioStage>,
    );
    const windowEl = container.firstElementChild!.firstElementChild as HTMLElement;
    expect(windowEl.style.borderRadius).toContain("--scenar-radius-window");
    expect(windowEl.style.boxShadow).toContain("--scenar-shadow-window");
    expect(windowEl.style.overflow).toBe("hidden");
  });
});
