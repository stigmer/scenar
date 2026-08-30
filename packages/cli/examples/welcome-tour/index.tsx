import type { ReactNode } from "react";
import {
  BrowserView,
  DashboardPage,
  DataTable,
  FormCard,
  LoginCardPage,
  StatusBadge,
  type NavLink,
  type SideNavItem,
} from "@scenar/react";
import type { TourStepData, TourScreen } from "./steps";
// Vite resolves an asset import to its hashed URL at pack time. This logo is
// larger than Vite's 4 KiB inline limit, so `scenar pack` emits it as a real
// .png file — exercising the image path through the deploy allowlist end to end.
import logoUrl from "./logo.png";

/**
 * Maps one step's data to view elements. This is the contract `scenar render`
 * (Remotion) and `scenar pack` (ScenarioPlayer) both consume: a pure function
 * from (data, stepIndex) to a ReactNode. The chrome is CSS-drawn via
 * @scenar/react shells + inline-SVG lucide icons; the one bundled asset is the
 * brand logo below, which demonstrates an image surviving pack and deploy.
 */
export function renderStep(data: TourStepData, stepIndex: number): ReactNode {
  return (
    <BrowserView url={`https://${data.url}`} contentKey={String(stepIndex)}>
      {renderScreen(data.screen)}
    </BrowserView>
  );
}

const NAV_LINKS: NavLink[] = [
  { label: "Home", active: true },
  { label: "Projects" },
  { label: "Settings" },
];

const SIDEBAR: SideNavItem[] = [
  { label: "Workspace", isSection: true },
  { label: "Overview", active: true },
  { label: "Projects" },
  { label: "Members" },
  { label: "Account", isSection: true },
  { label: "Profile" },
  { label: "Billing" },
];

function renderScreen(screen: TourScreen): ReactNode {
  switch (screen) {
    case "login":
      return (
        <LoginCardPage
          appName="Acme Cloud"
          subtitle="Sign in to your workspace"
          fields={[
            { label: "Email", value: "jordan@acme.cloud", type: "email" },
            { label: "Password", type: "password" },
          ]}
          submitLabel="Sign in"
          submitTargetId="sign-in"
          footerText="Forgot password?"
        />
      );

    case "dashboard":
      return (
        <DashboardPage
          appName="Acme Cloud"
          userName="Jordan"
          navLinks={NAV_LINKS}
          sidebarItems={SIDEBAR}
        >
          <div className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <img src={logoUrl} alt="Acme Cloud" width={24} height={24} className="rounded" />
              <h2 className="text-[15px] font-semibold text-[var(--scenar-foreground)]">
                Welcome back, Jordan
              </h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Active projects", value: "12" },
                { label: "Open tasks", value: "37" },
                { label: "Deploys today", value: "8" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-[var(--scenar-border)] bg-[var(--scenar-card)] p-4"
                >
                  <div className="text-[20px] font-semibold text-[var(--scenar-foreground)]">
                    {stat.value}
                  </div>
                  <div className="text-[11px] text-[var(--scenar-muted-foreground)]">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DashboardPage>
      );

    case "projects":
      return (
        <DashboardPage
          appName="Acme Cloud"
          userName="Jordan"
          navLinks={[
            { label: "Home" },
            { label: "Projects", active: true },
            { label: "Settings" },
          ]}
          sidebarItems={SIDEBAR}
        >
          <div className="p-5">
            <h2 className="mb-4 text-[15px] font-semibold text-[var(--scenar-foreground)]">
              Projects
            </h2>
            <DataTable
              columns={[
                { key: "name", label: "Name" },
                { key: "env", label: "Environment" },
                { key: "status", label: "Status", align: "right" },
              ]}
              rows={[
                {
                  id: "1",
                  cells: {
                    name: "checkout-api",
                    env: "production",
                    status: <StatusBadge label="Healthy" variant="success" />,
                  },
                },
                {
                  id: "2",
                  cells: {
                    name: "web-frontend",
                    env: "production",
                    status: <StatusBadge label="Deploying" variant="info" />,
                  },
                },
                {
                  id: "3",
                  cells: {
                    name: "billing-worker",
                    env: "staging",
                    status: <StatusBadge label="Degraded" variant="warning" />,
                  },
                },
              ]}
            />
          </div>
        </DashboardPage>
      );

    case "settings":
      return (
        <DashboardPage
          appName="Acme Cloud"
          userName="Jordan"
          navLinks={[
            { label: "Home" },
            { label: "Projects" },
            { label: "Settings", active: true },
          ]}
          sidebarItems={SIDEBAR}
        >
          <div className="flex justify-center p-6">
            <FormCard
              title="Profile"
              subtitle="Update your account details"
              fields={[
                { label: "Full name", value: "Jordan Rivera" },
                { label: "Email", value: "jordan@acme.cloud", type: "email" },
                { label: "Role", value: "Platform Engineer" },
              ]}
              submitLabel="Save changes"
              width={320}
            />
          </div>
        </DashboardPage>
      );
  }
}
