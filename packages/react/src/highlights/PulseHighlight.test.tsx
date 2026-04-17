import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { PulseHighlight } from "./PulseHighlight.js";

afterEach(cleanup);

describe("PulseHighlight", () => {
  it("renders with aria-hidden for screen reader exclusion", () => {
    const { container } = render(<PulseHighlight />);
    const span = container.firstElementChild as HTMLElement;
    expect(span.getAttribute("aria-hidden")).toBe("true");
  });

  it("uses --scenar-foreground for the border colour", () => {
    const { container } = render(<PulseHighlight />);
    const span = container.firstElementChild as HTMLElement;
    expect(span.style.borderColor).toBe("var(--scenar-foreground, currentColor)");
  });
});
