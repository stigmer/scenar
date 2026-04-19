"use client";

import { Copy } from "lucide-react";

interface SettingsField {
  readonly label: string;
  readonly value: string;
  /** Show a copy-to-clipboard icon next to the value. */
  readonly copyable?: boolean;
  /** Render the value as a locked/readonly input. Default true. */
  readonly readonly?: boolean;
  /** Optional helper text below the field. */
  readonly hint?: string;
}

interface SettingsFormProps {
  readonly fields: readonly SettingsField[];
  /** Optional title above the form (e.g. "API Settings"). */
  readonly title?: string;
  /** Optional description below the title. */
  readonly description?: string;
}

/**
 * Label-value settings form for service configuration pages.
 *
 * Renders a vertical list of labelled fields with optional copy
 * icons and helper text. Designed to mimic settings panels in
 * products like Auth0, Stripe, or AWS Console.
 */
export function SettingsForm({
  fields,
  title,
  description,
}: SettingsFormProps) {
  return (
    <div className="space-y-4">
      {(title || description) && (
        <div className="mb-1">
          {title && (
            <h3 className="text-[14px] font-semibold text-[var(--scenar-foreground)]">
              {title}
            </h3>
          )}
          {description && (
            <p className="mt-0.5 text-[12px] text-[var(--scenar-muted-foreground)]">
              {description}
            </p>
          )}
        </div>
      )}

      {fields.map((field, i) => (
        <div key={i}>
          <label className="mb-1 block text-[11px] font-medium text-[var(--scenar-muted-foreground)]">
            {field.label}
          </label>
          <div className="flex items-center gap-2">
            <div
              className={`flex-1 rounded-md border border-[var(--scenar-border)] px-3 py-1.5 text-[12px] ${
                field.readonly !== false
                  ? "bg-[var(--scenar-accent)] text-[var(--scenar-foreground)]"
                  : "bg-[var(--scenar-surface)] text-[var(--scenar-foreground)]"
              }`}
            >
              <span className="truncate">{field.value}</span>
            </div>
            {field.copyable && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--scenar-border)] bg-[var(--scenar-surface)]">
                <Copy className="h-3 w-3 text-[var(--scenar-muted-foreground)]" />
              </div>
            )}
          </div>
          {field.hint && (
            <p className="mt-1 text-[11px] text-[var(--scenar-muted-foreground)]">
              {field.hint}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export type { SettingsFormProps, SettingsField };
