"use client";

import { type ReactNode } from "react";

interface SideNavItem {
  readonly label: string;
  readonly icon?: ReactNode;
  readonly active?: boolean;
  /** Nesting depth (0 = top level). Indents the label. */
  readonly depth?: number;
  /** Section header (renders as a small-caps divider, not clickable). */
  readonly isSection?: boolean;
}

interface SideNavProps {
  readonly items: readonly SideNavItem[];
  /** Width in pixels (default 200). */
  readonly width?: number;
}

/**
 * Vertical sidebar navigation for SaaS-style page layouts.
 *
 * Renders a list of nav items with optional icons, active state accent
 * bar, nested indentation, and section headers. Pairs with `AppBar`
 * and `PageLayout` to build full-page compositions.
 */
export function SideNav({ items, width = 200 }: SideNavProps) {
  return (
    <aside
      className="shrink-0 overflow-y-auto border-r border-[var(--scenar-border)] bg-[var(--scenar-surface)] py-2"
      style={{ width }}
    >
      {items.map((item, i) => {
        if (item.isSection) {
          return (
            <div
              key={i}
              className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--scenar-muted-foreground)]"
            >
              {item.label}
            </div>
          );
        }

        const indent = (item.depth ?? 0) * 12;

        return (
          <div
            key={i}
            className={`relative flex items-center gap-2 px-4 py-1.5 text-[12px] ${
              item.active
                ? "font-medium text-[var(--scenar-foreground)]"
                : "text-[var(--scenar-muted-foreground)]"
            }`}
            style={{ paddingLeft: `${16 + indent}px` }}
          >
            {item.active && (
              <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r bg-[#3b82f6]" />
            )}
            {item.icon && <span className="shrink-0">{item.icon}</span>}
            <span className="truncate">{item.label}</span>
          </div>
        );
      })}
    </aside>
  );
}

export type { SideNavProps, SideNavItem };
