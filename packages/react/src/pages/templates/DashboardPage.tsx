"use client";

import { type ReactNode } from "react";
import { AppBar, type NavLink } from "../primitives/AppBar.js";
import { SideNav, type SideNavItem } from "../primitives/SideNav.js";
import { PageLayout } from "../primitives/PageLayout.js";

interface DashboardPageProps {
  /** Application name. */
  readonly appName: string;
  /** Custom logo for the AppBar. */
  readonly logo?: ReactNode;
  /** AppBar top-level nav links. */
  readonly navLinks?: readonly NavLink[];
  /** User name for the AppBar avatar. */
  readonly userName?: string;
  /** Sidebar navigation items. */
  readonly sidebarItems?: readonly SideNavItem[];
  /** Sidebar width (default 200). */
  readonly sidebarWidth?: number;
  /** Main content area. */
  readonly children: ReactNode;
}

/**
 * Authenticated dashboard with sidebar navigation.
 *
 * Full-page composition of AppBar + SideNav + scrollable content area.
 * Use for "post-login" or "admin panel" screens where the user has
 * navigated into the product.
 */
export function DashboardPage({
  appName,
  logo,
  navLinks,
  userName,
  sidebarItems,
  sidebarWidth,
  children,
}: DashboardPageProps) {
  return (
    <PageLayout
      header={
        <AppBar
          appName={appName}
          logo={logo}
          navLinks={navLinks}
          userName={userName}
        />
      }
      sidebar={
        sidebarItems ? (
          <SideNav items={sidebarItems} width={sidebarWidth} />
        ) : undefined
      }
    >
      {children}
    </PageLayout>
  );
}

export type { DashboardPageProps };
