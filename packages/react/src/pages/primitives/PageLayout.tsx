"use client";

import { type ReactNode } from "react";

interface PageLayoutProps {
  /** Top bar (typically `AppBar`). */
  readonly header?: ReactNode;
  /** Left sidebar (typically `SideNav`). */
  readonly sidebar?: ReactNode;
  /** Main page content. */
  readonly children: ReactNode;
  /** Optional right panel (e.g. detail pane, help sidebar). */
  readonly rightPanel?: ReactNode;
}

/**
 * Full-page grid for realistic SaaS layouts inside `BrowserView`.
 *
 * Composes header, optional sidebar, main content, and optional right
 * panel into a standard vertical + horizontal layout. All slots accept
 * arbitrary ReactNodes so you can mix primitives (AppBar, SideNav) or
 * custom content.
 *
 * Fills 100% of its parent's height — designed to be the direct child
 * of `BrowserView`'s content area.
 */
export function PageLayout({
  header,
  sidebar,
  children,
  rightPanel,
}: PageLayoutProps) {
  return (
    <div className="flex h-full flex-col bg-[var(--scenar-surface)]">
      {header}
      <div className="flex min-h-0 flex-1">
        {sidebar}
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
        {rightPanel}
      </div>
    </div>
  );
}

export type { PageLayoutProps };
