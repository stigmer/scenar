import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, within } from "@testing-library/react";
import { BrowserView } from "./BrowserView.js";

afterEach(cleanup);

describe("BrowserView", () => {
  it("renders the full URL in the address bar", () => {
    const { container } = render(
      <BrowserView url="https://example.com/login" contentKey="a">
        <p>page</p>
      </BrowserView>,
    );
    expect(within(container).getByText("https://example.com/login")).toBeDefined();
  });

  it("derives tab title from the URL host", () => {
    const { container } = render(
      <BrowserView url="https://auth.acme.io/callback?code=123" contentKey="a">
        <p>page</p>
      </BrowserView>,
    );
    expect(within(container).getByText("auth.acme.io")).toBeDefined();
  });

  it("applies the zoom prop to the outer container", () => {
    const { container } = render(
      <BrowserView url="https://example.com" contentKey="a" zoom={0.9}>
        <p>page</p>
      </BrowserView>,
    );
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.style.zoom).toBe("0.9");
  });
});
