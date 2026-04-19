import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, within } from "@testing-library/react";
import { DashboardView } from "./DashboardView.js";

afterEach(cleanup);

describe("DashboardView", () => {
  it("renders the default time range", () => {
    const { container } = render(
      <DashboardView contentKey="a">
        <p>Panel</p>
      </DashboardView>,
    );
    expect(within(container).getByText("Last 6 hours")).toBeDefined();
  });

  it("renders a custom time range", () => {
    const { container } = render(
      <DashboardView contentKey="a" timeRange="Last 24 hours">
        <p>Panel</p>
      </DashboardView>,
    );
    expect(within(container).getByText("Last 24 hours")).toBeDefined();
  });

  it("renders breadcrumbs", () => {
    const { container } = render(
      <DashboardView contentKey="a" breadcrumbs={["Home", "Metrics", "CPU"]}>
        <p>Panel</p>
      </DashboardView>,
    );
    expect(within(container).getByText("Home")).toBeDefined();
    expect(within(container).getByText("Metrics")).toBeDefined();
    expect(within(container).getByText("CPU")).toBeDefined();
  });

  it("falls back to title as a single breadcrumb", () => {
    const { container } = render(
      <DashboardView contentKey="a" title="My Dashboard">
        <p>Panel</p>
      </DashboardView>,
    );
    expect(within(container).getByText("My Dashboard")).toBeDefined();
  });

  it("renders default sidebar items when none are provided", () => {
    const { container } = render(
      <DashboardView contentKey="a">
        <p>Panel</p>
      </DashboardView>,
    );
    expect(within(container).getByText("Dashboards")).toBeDefined();
    expect(within(container).getByText("Alerting")).toBeDefined();
  });

  it("renders custom status text", () => {
    const { container } = render(
      <DashboardView contentKey="a" statusText="Updated 2m ago">
        <p>Panel</p>
      </DashboardView>,
    );
    expect(within(container).getByText("Updated 2m ago")).toBeDefined();
  });

  it("shows default Ready status when statusText is omitted", () => {
    const { container } = render(
      <DashboardView contentKey="a">
        <p>Panel</p>
      </DashboardView>,
    );
    expect(within(container).getByText("Ready")).toBeDefined();
  });

  it("renders children inside the content area", () => {
    const { container } = render(
      <DashboardView contentKey="a">
        <p>Dashboard content here</p>
      </DashboardView>,
    );
    expect(within(container).getByText("Dashboard content here")).toBeDefined();
  });
});
