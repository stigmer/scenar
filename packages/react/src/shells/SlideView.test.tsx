import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, within } from "@testing-library/react";
import { SlideView } from "./SlideView.js";

afterEach(cleanup);

describe("SlideView", () => {
  it("renders the default presentation title", () => {
    const { container } = render(
      <SlideView contentKey="a">
        <p>Slide content</p>
      </SlideView>,
    );
    expect(within(container).getByText("Untitled presentation")).toBeDefined();
  });

  it("renders a custom title", () => {
    const { container } = render(
      <SlideView contentKey="a" title="Product Launch">
        <p>Slide content</p>
      </SlideView>,
    );
    expect(within(container).getByText("Product Launch")).toBeDefined();
  });

  it("renders slide counter with defaults", () => {
    const { container } = render(
      <SlideView contentKey="a">
        <p>content</p>
      </SlideView>,
    );
    expect(within(container).getByText("Slide 1 of 1")).toBeDefined();
  });

  it("renders slide counter with custom values", () => {
    const { container } = render(
      <SlideView contentKey="a" currentSlide={3} totalSlides={12}>
        <p>content</p>
      </SlideView>,
    );
    expect(within(container).getByText("Slide 3 of 12")).toBeDefined();
  });

  it("renders speaker notes when provided", () => {
    const { container } = render(
      <SlideView contentKey="a" speakerNotes="Remember to mention the demo.">
        <p>content</p>
      </SlideView>,
    );
    expect(
      within(container).getByText("Remember to mention the demo."),
    ).toBeDefined();
  });

  it("does not render speaker notes when omitted", () => {
    const { container } = render(
      <SlideView contentKey="a">
        <p>content</p>
      </SlideView>,
    );
    expect(
      within(container).queryByText("Remember to mention the demo."),
    ).toBeNull();
  });

  it("renders the Present button", () => {
    const { container } = render(
      <SlideView contentKey="a">
        <p>content</p>
      </SlideView>,
    );
    expect(within(container).getByText("Present")).toBeDefined();
  });
});
