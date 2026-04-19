"use client";

import { type ReactNode } from "react";

interface FormField {
  readonly label: string;
  readonly value?: string;
  readonly placeholder?: string;
  readonly type?: "text" | "password" | "email";
}

interface FormCardProps {
  /** Card title (e.g. "Sign in to your account"). */
  readonly title?: string;
  readonly subtitle?: string;
  /** Slot for a logo or icon above the title. */
  readonly headerSlot?: ReactNode;
  readonly fields: readonly FormField[];
  /** Label for the primary action button (default "Submit"). */
  readonly submitLabel?: string;
  /** Optional secondary link below the button (e.g. "Forgot password?"). */
  readonly footerText?: string;
  /** Card width in pixels (default 280). */
  readonly width?: number;
  /** Optional extra content below the fields, above the button. */
  readonly children?: ReactNode;
}

/**
 * Centred card with form fields and a primary action button.
 *
 * Used inside `LoginCardPage` and other templates to render realistic
 * login/signup/config forms. Fields are presentational only -- no
 * actual form state or submission.
 */
export function FormCard({
  title,
  subtitle,
  headerSlot,
  fields,
  submitLabel = "Submit",
  footerText,
  width = 280,
  children,
}: FormCardProps) {
  return (
    <div
      className="rounded-lg border border-[var(--scenar-border)] bg-[var(--scenar-card)] p-5 shadow-sm"
      style={{ width }}
    >
      {/* Header */}
      {(headerSlot || title) && (
        <div className="mb-4 text-center">
          {headerSlot && <div className="mb-2 flex justify-center">{headerSlot}</div>}
          {title && (
            <h3 className="text-[14px] font-semibold text-[var(--scenar-foreground)]">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="mt-0.5 text-[12px] text-[var(--scenar-muted-foreground)]">
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* Fields */}
      <div className="space-y-2.5">
        {fields.map((field, i) => (
          <div key={i}>
            <label className="mb-0.5 block text-[11px] font-medium text-[var(--scenar-muted-foreground)]">
              {field.label}
            </label>
            <div className="rounded-md border border-[var(--scenar-border)] bg-[var(--scenar-surface)] px-2.5 py-1.5 text-[12px]">
              {field.type === "password" ? (
                <span className="text-[var(--scenar-muted-foreground)]">
                  {"•".repeat(12)}
                </span>
              ) : field.value ? (
                <span className="text-[var(--scenar-foreground)]">
                  {field.value}
                </span>
              ) : (
                <span className="text-[var(--scenar-muted-foreground)]">
                  {field.placeholder ?? ""}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {children}

      {/* Submit button */}
      <div className="mt-4">
        <div className="rounded-md bg-[#3b82f6] py-1.5 text-center text-[12px] font-medium text-white">
          {submitLabel}
        </div>
      </div>

      {/* Footer */}
      {footerText && (
        <p className="mt-3 text-center text-[11px] text-[var(--scenar-muted-foreground)]">
          {footerText}
        </p>
      )}
    </div>
  );
}

export type { FormCardProps, FormField };
