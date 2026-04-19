"use client";

import { type ReactNode } from "react";
import { Plus } from "lucide-react";
import { AppBar, type NavLink } from "../primitives/AppBar.js";
import { Breadcrumb } from "../primitives/Breadcrumb.js";
import { DataTable, type DataTableColumn, type DataTableRow } from "../primitives/DataTable.js";
import { PageLayout } from "../primitives/PageLayout.js";

interface AdminListPageProps {
  /** Service/product name shown in the AppBar. */
  readonly appName: string;
  /** Custom logo for the AppBar. */
  readonly logo?: ReactNode;
  /** AppBar navigation links. */
  readonly navLinks?: readonly NavLink[];
  /** Breadcrumb path (e.g. ["Admin", "Tenants"]). */
  readonly breadcrumbs?: readonly string[];
  /** Page heading above the table. */
  readonly title: string;
  /** Optional description below the heading. */
  readonly description?: string;
  /** CTA button label (e.g. "Create tenant"). Omit to hide. */
  readonly ctaLabel?: string;
  /** Optional cursor-target id for the CTA button. */
  readonly ctaTargetId?: string;
  /** Table column definitions. */
  readonly columns: readonly DataTableColumn[];
  /** Table rows. */
  readonly rows: readonly DataTableRow[];
  /** Optional sidebar. */
  readonly sidebar?: ReactNode;
}

/**
 * Admin list/table page — AppBar + breadcrumbs + header + DataTable.
 *
 * Models resource-management pages (tenant lists, user lists, API key
 * lists) found in admin panels. Includes an optional CTA button for
 * "Create" actions.
 */
export function AdminListPage({
  appName,
  logo,
  navLinks,
  breadcrumbs,
  title,
  description,
  ctaLabel,
  ctaTargetId,
  columns,
  rows,
  sidebar,
}: AdminListPageProps) {
  return (
    <PageLayout
      header={<AppBar appName={appName} logo={logo} navLinks={navLinks} />}
      sidebar={sidebar}
    >
      <div className="space-y-4 p-4">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumb items={breadcrumbs} />
        )}

        {/* Page header + CTA */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-semibold text-[var(--scenar-foreground)]">
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-[12px] text-[var(--scenar-muted-foreground)]">
                {description}
              </p>
            )}
          </div>
          {ctaLabel && (
            <div
              className="flex items-center gap-1 rounded-md bg-[#3b82f6] px-3 py-1.5 text-[12px] font-medium text-white"
              data-cursor-target={ctaTargetId}
            >
              <Plus className="h-3 w-3" />
              {ctaLabel}
            </div>
          )}
        </div>

        <DataTable columns={columns} rows={rows} />
      </div>
    </PageLayout>
  );
}

export type { AdminListPageProps };
