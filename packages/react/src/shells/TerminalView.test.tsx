import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, within } from "@testing-library/react";
import { TerminalView } from "./TerminalView.js";
import type { TerminalLine } from "./TerminalView.js";

afterEach(cleanup);

const LINES: readonly TerminalLine[] = [
  { type: "prompt", text: "echo hello" },
  { type: "success", text: "hello" },
  { type: "error", text: "connection refused" },
  { type: "blank", text: "" },
];

describe("TerminalView", () => {
  it("renders prompt lines with the cwd prefix", () => {
    const { container } = render(
      <TerminalView lines={LINES} contentKey="a" cwd="~/project" />,
    );
    expect(within(container).getByText("~/project")).toBeDefined();
  });

  it("defaults cwd to ~", () => {
    const { container } = render(
      <TerminalView lines={LINES} contentKey="a" />,
    );
    const cwdSpans = container.querySelectorAll(".text-\\[\\#bd93f9\\]");
    expect(cwdSpans.length).toBe(1);
    expect(cwdSpans[0]!.textContent).toBe("~");
  });

  it("renders the custom title in the title bar", () => {
    const { container } = render(
      <TerminalView lines={LINES} contentKey="a" title="bash" />,
    );
    const titleBar = container.querySelector(".text-\\[\\#a0a0a0\\]");
    expect(titleBar?.textContent).toBe("bash");
  });

  it("defaults title to Terminal", () => {
    const { container } = render(
      <TerminalView lines={LINES} contentKey="a" />,
    );
    const titleBar = container.querySelector(".text-\\[\\#a0a0a0\\]");
    expect(titleBar?.textContent).toBe("Terminal");
  });
});
