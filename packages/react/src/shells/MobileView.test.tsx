import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, within } from "@testing-library/react";
import { MobileView } from "./MobileView.js";

afterEach(cleanup);

describe("MobileView", () => {
  it("renders the default time 9:41 in the status bar", () => {
    const { container } = render(
      <MobileView contentKey="a">
        <p>App content</p>
      </MobileView>,
    );
    expect(within(container).getByText("9:41")).toBeDefined();
  });

  it("renders a custom time when provided", () => {
    const { container } = render(
      <MobileView contentKey="a" statusBar={{ time: "10:30" }}>
        <p>App content</p>
      </MobileView>,
    );
    expect(within(container).getByText("10:30")).toBeDefined();
  });

  it("renders an optional carrier label", () => {
    const { container } = render(
      <MobileView contentKey="a" statusBar={{ carrier: "T-Mobile" }}>
        <p>App content</p>
      </MobileView>,
    );
    expect(within(container).getByText("T-Mobile")).toBeDefined();
  });

  it("renders children inside the content area", () => {
    const { container } = render(
      <MobileView contentKey="a">
        <p>My mobile app</p>
      </MobileView>,
    );
    expect(within(container).getByText("My mobile app")).toBeDefined();
  });

  it("applies the zoom prop to the outer container", () => {
    const { container } = render(
      <MobileView contentKey="a" zoom={0.8}>
        <p>content</p>
      </MobileView>,
    );
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.style.zoom).toBe("0.8");
  });
});
