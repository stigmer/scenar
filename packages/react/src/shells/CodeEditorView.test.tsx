import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, within } from "@testing-library/react";
import { CodeEditorView } from "./CodeEditorView.js";
import type { FileTreeEntry } from "./CodeEditorView.js";

afterEach(cleanup);

const CODE_LINES = [
  'import { Agent } from "@scenar/core";',
  "",
  "const agent = new Agent();",
];

const FILE_TREE: readonly FileTreeEntry[] = [
  { name: "src", type: "folder", depth: 0 },
  { name: "index.ts", type: "file", depth: 1 },
  { name: "package.json", type: "file", depth: 0 },
];

describe("CodeEditorView", () => {
  it("renders the filename in the editor tab", () => {
    const { container } = render(
      <CodeEditorView filename="index.ts" lines={CODE_LINES} contentKey="a" />,
    );
    expect(within(container).getByText("index.ts")).toBeDefined();
  });

  it("shows the explorer panel when fileTree is provided", () => {
    const { container } = render(
      <CodeEditorView
        filename="index.ts"
        lines={CODE_LINES}
        fileTree={FILE_TREE}
        contentKey="a"
      />,
    );
    expect(within(container).getByText("Explorer")).toBeDefined();
  });

  it("hides the explorer panel when fileTree is omitted", () => {
    const { container } = render(
      <CodeEditorView filename="index.ts" lines={CODE_LINES} contentKey="a" />,
    );
    expect(within(container).queryByText("Explorer")).toBeNull();
  });

  it("highlights specified line indices", () => {
    const { container } = render(
      <CodeEditorView
        filename="index.ts"
        lines={CODE_LINES}
        highlightLines={[0, 2]}
        contentKey="a"
      />,
    );
    const codeLines = container.querySelectorAll(".whitespace-pre");
    expect(codeLines[0]?.className).toContain("bg-[#007acc]/10");
    expect(codeLines[1]?.className).not.toContain("bg-[#007acc]/10");
    expect(codeLines[2]?.className).toContain("bg-[#007acc]/10");
  });
});
