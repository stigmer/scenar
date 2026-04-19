"use client";

import { ChevronRight } from "lucide-react";

interface BreadcrumbProps {
  readonly items: readonly string[];
}

/**
 * Breadcrumb trail for page headers.
 *
 * Renders a chevron-separated path; the last item is highlighted as
 * the current page.
 */
export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1 text-[12px]">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 text-[#64748b]" />}
          <span
            className={
              i === items.length - 1
                ? "font-medium text-[var(--scenar-foreground)]"
                : "text-[#64748b]"
            }
          >
            {item}
          </span>
        </span>
      ))}
    </nav>
  );
}

export type { BreadcrumbProps };
