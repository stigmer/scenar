import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, within } from "@testing-library/react";
import { APIClientView } from "./APIClientView.js";

afterEach(cleanup);

describe("APIClientView", () => {
  it("renders the URL in the request bar", () => {
    const { container } = render(
      <APIClientView
        method="GET"
        url="https://api.example.com/users"
        contentKey="a"
      />,
    );
    expect(
      within(container).getByText("https://api.example.com/users"),
    ).toBeDefined();
  });

  it("renders the method badge with correct colour for GET", () => {
    const { container } = render(
      <APIClientView
        method="GET"
        url="https://api.example.com/users"
        contentKey="a"
      />,
    );
    const badges = within(container).getAllByText("GET");
    const methodBadge = badges.find((el) =>
      el.className.includes("rounded"),
    ) as HTMLElement | undefined;
    expect(methodBadge).toBeDefined();
    expect(methodBadge!.style.color).toBe("rgb(73, 204, 144)");
  });

  it("renders the method badge with correct colour for DELETE", () => {
    const { container } = render(
      <APIClientView
        method="DELETE"
        url="https://api.example.com/users/1"
        contentKey="a"
      />,
    );
    const badges = within(container).getAllByText("DELETE");
    const methodBadge = badges.find((el) =>
      el.className.includes("rounded"),
    ) as HTMLElement | undefined;
    expect(methodBadge).toBeDefined();
    expect(methodBadge!.style.color).toBe("rgb(249, 62, 62)");
  });

  it("renders request body when provided", () => {
    const body = '{ "name": "Alice" }';
    const { container } = render(
      <APIClientView
        method="POST"
        url="https://api.example.com/users"
        requestBody={body}
        contentKey="a"
      />,
    );
    expect(within(container).getByText('{ "name": "Alice" }')).toBeDefined();
  });

  it("renders the status badge for 200 OK", () => {
    const { container } = render(
      <APIClientView
        method="GET"
        url="https://api.example.com/users"
        responseBody='[{"id":1}]'
        statusCode={200}
        contentKey="a"
      />,
    );
    expect(within(container).getByText("200 OK")).toBeDefined();
  });

  it("renders the status badge with red for 404", () => {
    const { container } = render(
      <APIClientView
        method="GET"
        url="https://api.example.com/missing"
        responseBody='{"error":"not found"}'
        statusCode={404}
        contentKey="a"
      />,
    );
    const badge = within(container).getByText("404 Not Found");
    expect(badge.style.color).toBe("rgb(249, 62, 62)");
  });

  it("renders response time when provided", () => {
    const { container } = render(
      <APIClientView
        method="GET"
        url="https://api.example.com/users"
        responseBody="[]"
        statusCode={200}
        responseTimeMs={142}
        contentKey="a"
      />,
    );
    expect(within(container).getByText("142ms")).toBeDefined();
  });

  it("renders response size when provided", () => {
    const { container } = render(
      <APIClientView
        method="GET"
        url="https://api.example.com/users"
        responseBody="[]"
        statusCode={200}
        responseSize="1.2 KB"
        contentKey="a"
      />,
    );
    expect(within(container).getByText("1.2 KB")).toBeDefined();
  });

  it("renders the Send button", () => {
    const { container } = render(
      <APIClientView
        method="GET"
        url="https://api.example.com"
        contentKey="a"
      />,
    );
    expect(within(container).getByText("Send")).toBeDefined();
  });
});
