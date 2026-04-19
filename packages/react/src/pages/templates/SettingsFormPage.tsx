"use client";

import { type ReactNode } from "react";
import { AppBar } from "../primitives/AppBar.js";
import { Breadcrumb } from "../primitives/Breadcrumb.js";
import { PageLayout } from "../primitives/PageLayout.js";
import { SettingsForm, type SettingsField } from "../primitives/SettingsForm.js";

interface SettingsFormPageProps {
  /** Service/product name shown in the AppBar. */
  readonly serviceName: string;
  /** Custom logo for the AppBar. */
  readonly serviceLogo?: ReactNode;
  /** Breadcrumb path (e.g. ["Settings", "API", "My API"]). */
  readonly breadcrumbs?: readonly string[];
  /** Form title displayed above the fields. */
  readonly title?: string;
  /** Form description. */
  readonly description?: string;
  /** Settings fields. */
  readonly fields: readonly SettingsField[];
  /** Optional sidebar slot for service-level navigation. */
  readonly sidebar?: ReactNode;
  /** Extra content below the settings form. */
  readonly children?: ReactNode;
}

/**
 * Full-page settings form — AppBar + breadcrumbs + SettingsForm.
 *
 * Models configuration pages in services like Auth0, Stripe, or
 * AWS Console. Use inside `BrowserView` for realistic "third-party
 * service" screenshots.
 */
export function SettingsFormPage({
  serviceName,
  serviceLogo,
  breadcrumbs,
  title,
  description,
  fields,
  sidebar,
  children,
}: SettingsFormPageProps) {
  return (
    <PageLayout
      header={<AppBar appName={serviceName} logo={serviceLogo} hideSearch hideNotifications />}
      sidebar={sidebar}
    >
      <div className="space-y-4 p-4">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumb items={breadcrumbs} />
        )}
        <SettingsForm title={title} description={description} fields={fields} />
        {children}
      </div>
    </PageLayout>
  );
}

export type { SettingsFormPageProps };
