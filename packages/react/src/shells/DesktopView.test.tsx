import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, within } from "@testing-library/react";
import { DesktopView } from "./DesktopView.js";

afterEach(cleanup);

describe("DesktopView", () => {
  it("renders the app title in the title bar", () => {
    const { container } = render(
      <DesktopView title="Stigmer" contentKey="a">
        <p>content</p>
      </DesktopView>,
    );
    expect(within(container).getByText("Stigmer")).toBeDefined();
  });

  it("renders children in the content area", () => {
    const { container } = render(
      <DesktopView title="My App" contentKey="a">
        <p>hello world</p>
      </DesktopView>,
    );
    expect(within(container).getByText("hello world")).toBeDefined();
  });

  it("applies the zoom prop to the outer container", () => {
    const { container } = render(
      <DesktopView title="App" contentKey="a" zoom={0.9}>
        <p>content</p>
      </DesktopView>,
    );
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.style.zoom).toBe("0.9");
  });
});
