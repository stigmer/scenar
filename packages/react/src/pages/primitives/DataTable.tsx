"use client";

import { type ReactNode } from "react";

interface DataTableColumn {
  readonly key: string;
  readonly label: string;
  /** Tailwind width class (e.g. "w-1/3"). Defaults to auto. */
  readonly width?: string;
  readonly align?: "left" | "center" | "right";
}

interface DataTableRow {
  readonly id: string;
  readonly cells: Record<string, ReactNode>;
}

interface DataTableProps {
  readonly columns: readonly DataTableColumn[];
  readonly rows: readonly DataTableRow[];
  /** Optional empty-state message. */
  readonly emptyText?: string;
}

/**
 * Data table with header and rows for admin/list pages.
 *
 * Accepts typed column definitions and rows with cell content keyed
 * by column `key`. Cells can contain strings, `StatusBadge` elements,
 * or any ReactNode for full flexibility.
 */
export function DataTable({ columns, rows, emptyText }: DataTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--scenar-border)]">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-[var(--scenar-border)] bg-[var(--scenar-accent)]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-3 py-2 font-medium text-[var(--scenar-muted-foreground)] ${
                  col.width ?? ""
                } text-${col.align ?? "left"}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && emptyText && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-6 text-center text-[var(--scenar-muted-foreground)]"
              >
                {emptyText}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-[var(--scenar-border)] last:border-b-0"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-3 py-2 text-[var(--scenar-foreground)] ${
                    col.width ?? ""
                  } text-${col.align ?? "left"}`}
                >
                  {row.cells[col.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type { DataTableProps, DataTableColumn, DataTableRow };
