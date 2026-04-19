import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, within } from "@testing-library/react";
import { ChatView, ChatBubble, TypingIndicator } from "./ChatView.js";

afterEach(cleanup);

describe("ChatView", () => {
  it("renders the default title", () => {
    const { container } = render(
      <ChatView contentKey="a">
        <ChatBubble role="user">Hello</ChatBubble>
      </ChatView>,
    );
    expect(within(container).getByText("Chat")).toBeDefined();
  });

  it("renders a custom title", () => {
    const { container } = render(
      <ChatView contentKey="a" title="Support Agent">
        <ChatBubble role="assistant">How can I help?</ChatBubble>
      </ChatView>,
    );
    expect(within(container).getByText("Support Agent")).toBeDefined();
  });

  it("renders a subtitle", () => {
    const { container } = render(
      <ChatView contentKey="a" subtitle="Online">
        <ChatBubble role="user">Hi</ChatBubble>
      </ChatView>,
    );
    expect(within(container).getByText("Online")).toBeDefined();
  });

  it("renders the input placeholder", () => {
    const { container } = render(
      <ChatView contentKey="a" inputPlaceholder="Type here...">
        <ChatBubble role="user">Hi</ChatBubble>
      </ChatView>,
    );
    expect(within(container).getByText("Type here...")).toBeDefined();
  });
});

describe("ChatBubble", () => {
  it("renders children content", () => {
    const { container } = render(
      <ChatView contentKey="a">
        <ChatBubble role="user">Test message</ChatBubble>
      </ChatView>,
    );
    expect(within(container).getByText("Test message")).toBeDefined();
  });

  it("renders a timestamp when provided", () => {
    const { container } = render(
      <ChatView contentKey="a">
        <ChatBubble role="assistant" timestamp="2:30 PM">
          Response
        </ChatBubble>
      </ChatView>,
    );
    expect(within(container).getByText("2:30 PM")).toBeDefined();
  });

  it("aligns user bubbles to the right", () => {
    const { container } = render(
      <ChatView contentKey="a">
        <ChatBubble role="user">User msg</ChatBubble>
      </ChatView>,
    );
    const bubble = within(container).getByText("User msg").closest("[class*='items-']");
    expect(bubble?.className).toContain("items-end");
  });

  it("aligns assistant bubbles to the left", () => {
    const { container } = render(
      <ChatView contentKey="a">
        <ChatBubble role="assistant">Bot msg</ChatBubble>
      </ChatView>,
    );
    const bubble = within(container).getByText("Bot msg").closest("[class*='items-']");
    expect(bubble?.className).toContain("items-start");
  });
});

describe("TypingIndicator", () => {
  it("renders three animated dots", () => {
    const { container } = render(
      <ChatView contentKey="a">
        <TypingIndicator />
      </ChatView>,
    );
    const dots = container.querySelectorAll(".rounded-full.bg-\\[\\#999\\]");
    expect(dots.length).toBe(3);
  });
});
