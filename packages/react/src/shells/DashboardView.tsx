"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  ChevronRight,
  LayoutDashboard,
  RefreshCcw,
  Search,
  Unplug,
  User,
} from "lucide-react";
import { SHELL_HEIGHT_DEFAULT, SHELL_HEIGHT_MIN } from "./tokens.js";

export interface SidebarItem {
  readonly label: string;
  readonly icon?: ReactNode;
  readonly active?: boolean;
}

interface DashboardViewProps {
  readonly title?: string;
  readonly breadcrumbs?: readonly string[];
  readonly sidebarItems?: readonly SidebarItem[];
  readonly sidebarCollapsed?: boolean;
  readonly timeRange?: string;
  readonly statusText?: string;
  readonly contentKey: string;
  readonly slideDirection?: "forward" | "backward";
  readonly children: ReactNode;
}

const DEFAULT_SIDEBAR_ITEMS: readonly SidebarItem[] = [
  { label: "Search", icon: <Search className="h-4 w-4" />, active: false },
  {
    label: "Dashboards",
    icon: <LayoutDashboard className="h-4 w-4" />,
    active: true,
  },
  { label: "Alerting", icon: <Bell className="h-4 w-4" />, active: false },
  {
    label: "Connections",
    icon: <Unplug className="h-4 w-4" />,
    active: false,
  },
];

/**
 * Grafana-style monitoring dashboard shell for scenario demos.
 *
 * Renders a dark top nav with breadcrumbs and a time-range pill, an
 * optional icon sidebar with active-state accent bar, a content area
 * for dashboard panels, and a thin status bar.
 */
export function DashboardView({
  title,
  breadcrumbs,
  sidebarItems,
  sidebarCollapsed = false,
  timeRange = "Last 6 hours",
  statusText,
  contentKey,
  slideDirection,
  children,
}: DashboardViewProps) {
  const slideX =
    slideDirection === "forward" ? 24 : slideDirection === "backward" ? -24 : 0;

  const items = sidebarItems ?? DEFAULT_SIDEBAR_ITEMS;
  const showSidebar = sidebarItems !== undefined || sidebarItems === undefined;
  const sidebarWidth = sidebarCollapsed ? "48px" : "200px";

  const crumbs =
    breadcrumbs && breadcrumbs.length > 0
      ? breadcrumbs
      : title
        ? [title]
        : ["Home"];

  return (
    <div
      className="flex flex-col overflow-hidden rounded-lg border border-[#2a2a2e]"
      style={{
        height: `var(--scenar-shell-height, clamp(${SHELL_HEIGHT_MIN}px, 55vh, ${SHELL_HEIGHT_DEFAULT}px))`,
      }}
    >
      {/* Top nav */}
      <div className="flex items-center justify-between border-b border-[#2a2a2e] bg-[#181b1f] px-3 py-1.5">
        {/* Left: logo mark + breadcrumbs */}
        <div className="flex items-center gap-2">
          {/* Abstract dashboard icon (not Grafana's logo) */}
          <div className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-[#ff6600] to-[#f5a623]">
            <LayoutDashboard className="h-3.5 w-3.5 text-white" />
          </div>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 text-[12px]">
            {crumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && (
                  <ChevronRight className="h-3 w-3 text-[#6e7681]" />
                )}
                <span
                  className={
                    i === crumbs.length - 1
                      ? "text-[#e8eaed]"
                      : "text-[#6e7681]"
                  }
                >
                  {crumb}
                </span>
              </span>
            ))}
          </div>
        </div>

        {/* Right: time range, refresh, avatar */}
        <div className="flex items-center gap-2">
          <span className="rounded border border-[#3a3f47] bg-[#111217] px-2 py-0.5 text-[11px] text-[#bdc1c6]">
            {timeRange}
          </span>
          <RefreshCcw className="h-3.5 w-3.5 text-[#6e7681]" />
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#3274d9]">
            <User className="h-3 w-3 text-white" />
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {showSidebar && (
          <div
            className="shrink-0 overflow-y-auto border-r border-[#2a2a2e] bg-[#111217] py-2"
            style={{ width: sidebarWidth }}
          >
            {items.map((item, i) => (
              <div
                key={i}
                className={`relative flex items-center gap-2.5 px-3 py-1.5 text-[12px] ${
                  item.active
                    ? "text-white"
                    : "text-[#6e7681]"
                }`}
              >
                {/* Active accent bar */}
                {item.active && (
                  <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r bg-[#3274d9]" />
                )}
                <span className="shrink-0">
                  {item.icon ?? (
                    <LayoutDashboard className="h-4 w-4" />
                  )}
                </span>
                {!sidebarCollapsed && (
                  <span className="truncate">{item.label}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Content area */}
        <motion.div
          key={contentKey}
          className="flex-1 overflow-y-auto bg-[#111217] p-3"
          initial={{ opacity: 0, x: slideX }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between border-t border-[#2a2a2e] bg-[#181b1f] px-3 py-0.5">
        <span className="text-[10px] text-[#6e7681]">
          {statusText ?? "Ready"}
        </span>
        <div className="flex items-center gap-1.5 text-[10px] text-[#6e7681]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
          <span>Connected</span>
        </div>
      </div>
    </div>
  );
}

export type { DashboardViewProps };
