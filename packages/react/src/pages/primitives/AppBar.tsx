"use client";

import { type ReactNode } from "react";
import { Bell, Search } from "lucide-react";

interface NavLink {
  readonly label: string;
  readonly active?: boolean;
}

interface AppBarProps {
  /** App/service name shown next to the logo. */
  readonly appName?: string;
  /** Custom logo element (icon, image, SVG). Falls back to a letter avatar. */
  readonly logo?: ReactNode;
  readonly navLinks?: readonly NavLink[];
  /** User display name for the avatar tooltip. First letter shown in the circle. */
  readonly userName?: string;
  /** Hide the search icon. */
  readonly hideSearch?: boolean;
  /** Hide the notification bell. */
  readonly hideNotifications?: boolean;
}

/**
 * Top navigation bar for realistic page layouts.
 *
 * Renders a horizontal bar with logo + app name on the left, optional
 * nav links in the centre, and user/search/notification icons on the
 * right. Styled as a generic SaaS top-nav so it blends with any
 * branded BrowserView content.
 */
export function AppBar({
  appName,
  logo,
  navLinks,
  userName,
  hideSearch,
  hideNotifications,
}: AppBarProps) {
  const initial = (userName ?? appName ?? "A")[0]?.toUpperCase() ?? "A";

  return (
    <header className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--scenar-border)] bg-[var(--scenar-surface)] px-4">
      {/* Left: logo + name + nav */}
      <div className="flex items-center gap-3">
        {/* Logo */}
        <div className="flex items-center gap-2">
          {logo ?? (
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#3b82f6]">
              <span className="text-[10px] font-bold leading-none text-white">
                {initial}
              </span>
            </div>
          )}
          {appName && (
            <span className="text-[13px] font-semibold text-[var(--scenar-foreground)]">
              {appName}
            </span>
          )}
        </div>

        {/* Nav links */}
        {navLinks && navLinks.length > 0 && (
          <nav className="ml-4 flex items-center gap-1">
            {navLinks.map((link, i) => (
              <span
                key={i}
                className={`rounded-md px-2.5 py-1 text-[12px] ${
                  link.active
                    ? "bg-[var(--scenar-accent)] font-medium text-[var(--scenar-foreground)]"
                    : "text-[var(--scenar-muted-foreground)]"
                }`}
              >
                {link.label}
              </span>
            ))}
          </nav>
        )}
      </div>

      {/* Right: search + notifications + avatar */}
      <div className="flex items-center gap-2.5">
        {!hideSearch && (
          <Search className="h-3.5 w-3.5 text-[var(--scenar-muted-foreground)]" />
        )}
        {!hideNotifications && (
          <Bell className="h-3.5 w-3.5 text-[var(--scenar-muted-foreground)]" />
        )}
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#6366f1]">
          <span className="text-[10px] font-medium leading-none text-white">
            {initial}
          </span>
        </div>
      </div>
    </header>
  );
}

export type { AppBarProps, NavLink };
