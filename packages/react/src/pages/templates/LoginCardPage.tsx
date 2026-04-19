"use client";

import { type ReactNode } from "react";
import { FormCard, type FormField } from "../primitives/FormCard.js";

interface LoginCardPageProps {
  /** Application name displayed in the card header. */
  readonly appName: string;
  /** Custom logo element above the title. */
  readonly logo?: ReactNode;
  /** Short tagline below the app name (e.g. "Sign in to your account"). */
  readonly subtitle?: string;
  /** Form fields (email, password, etc.). */
  readonly fields: readonly FormField[];
  /** Primary button label (default "Sign in"). */
  readonly submitLabel?: string;
  /** Optional link text below the button (e.g. "Forgot password?"). */
  readonly footerText?: string;
  /** Card width (default 280). */
  readonly cardWidth?: number;
  /** Background gradient CSS value. Defaults to a subtle vertical gradient. */
  readonly background?: string;
  /**
   * Slot for a thin top bar (e.g. AppBar). When omitted, the page
   * renders as a bare centred card — suitable for OAuth/SSO login
   * screens.
   */
  readonly topBar?: ReactNode;
  /**
   * Optional cursor-target attribute on the submit button so
   * Scenar cursor can point at it.
   */
  readonly submitTargetId?: string;
}

/**
 * Full-page branded login form.
 *
 * Renders a centred `FormCard` on a gradient background with an
 * optional top bar. Designed as a drop-in for any "user logs in on
 * your platform" step in a scenario.
 */
export function LoginCardPage({
  appName,
  logo,
  subtitle,
  fields,
  submitLabel = "Sign in",
  footerText,
  cardWidth = 280,
  background,
  topBar,
  submitTargetId,
}: LoginCardPageProps) {
  const bg =
    background ??
    "linear-gradient(to bottom, var(--scenar-surface), color-mix(in srgb, var(--scenar-accent) 30%, var(--scenar-surface)))";

  const headerSlot = logo ?? (
    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3b82f6]/10">
      <span className="text-sm font-bold text-[#3b82f6]">
        {appName[0]?.toUpperCase() ?? "A"}
      </span>
    </div>
  );

  return (
    <div className="flex h-full flex-col" style={{ background: bg }}>
      {topBar}
      <div className="flex flex-1 items-center justify-center">
        <div data-cursor-target={submitTargetId}>
          <FormCard
            title={appName}
            subtitle={subtitle ?? "Sign in to your account"}
            headerSlot={headerSlot}
            fields={fields}
            submitLabel={submitLabel}
            footerText={footerText}
            width={cardWidth}
          />
        </div>
      </div>
    </div>
  );
}

export type { LoginCardPageProps };
