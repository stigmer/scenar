# Page Primitives, Templates, and Terminal Content Improvements

**Date**: April 19, 2026

## Summary

Added a three-layer page component system to `@scenar/react` that provides reusable primitives and pre-composed templates for rendering realistic web-page content inside `BrowserView`. Also improved `TerminalView` content distribution so terminal demos fill the viewport naturally instead of cramming text into the left edge at tiny font sizes.

## Problem Statement

Scenario demos that show browser content (login pages, settings panels, admin dashboards) relied on hand-built inline Tailwind mockups in each scenario file. These looked like wireframes — a 208px card floating in 896px of empty space — not real web pages. Every new scenario had to reinvent the same patterns, leading to visual inconsistency and maintenance burden across 30+ scenarios.

Terminal demos had the opposite scaling problem: 11px monospace text with minimal padding (`px-3`) left most of the viewport empty, making the terminal look sparse and unrealistic.

### Pain Points

- Browser content inside `BrowserView` looked like wireframes, not production UIs
- Each scenario duplicated login/settings/admin page layouts from scratch
- No shared component vocabulary for "what a SaaS page looks like"
- `TerminalView` text was too small (11px) and left-aligned with insufficient padding
- No way to customise terminal font size per scenario

## Solution

Introduced a three-layer hybrid architecture inside `@scenar/react`:

1. **Primitives** (`pages/primitives/`) — 8 composable building blocks (PageLayout, AppBar, SideNav, FormCard, DataTable, SettingsForm, Breadcrumb, StatusBadge) that use Tailwind and `--scenar-*` theme tokens. Framework-agnostic, no MUI dependency.

2. **Templates** (`pages/templates/`) — 4 pre-composed page layouts (LoginCardPage, SettingsFormPage, AdminListPage, DashboardPage) that combine primitives into common patterns scenario authors reach for first.

3. **Custom views** (unchanged, in each product's scenario code) — for product-specific content that doesn't fit a template, authors compose from primitives or build fully custom.

For `TerminalView`, adjusted padding, font size, line height, and spacing to produce a more natural terminal appearance.

## Implementation Details

### New Primitives (packages/react/src/pages/primitives/)

| Component | Purpose |
|-----------|---------|
| `PageLayout` | Full-page grid: optional sidebar + header + main content + right panel |
| `AppBar` | Top nav with logo, nav links, search/bell/avatar — generic SaaS chrome |
| `SideNav` | Vertical sidebar with items, sections, active state, indentation |
| `FormCard` | Centred card with form fields, submit button, footer text |
| `DataTable` | Typed columns + rows with ReactNode cells, empty state |
| `SettingsForm` | Label-value fields with copy icons and hints |
| `Breadcrumb` | Chevron-separated path trail |
| `StatusBadge` | Coloured pill (success/warning/error/info/neutral) |

All primitives:
- Use `var(--scenar-surface)`, `var(--scenar-border)`, `var(--scenar-foreground)`, etc.
- Work in both light and dark Scenar themes
- Are sized to look correct at BrowserView's canonical 896px width

### New Templates (packages/react/src/pages/templates/)

| Template | Replaces |
|----------|----------|
| `LoginCardPage` | Inline `LoginPage` / `PlatformLoginPage` in Stigmer scenarios |
| `SettingsFormPage` | Inline `AuthDashboardPage` in register-idp-playback |
| `AdminListPage` | Inline `TenantAdminPage` in multi-tenant-setup-playback |
| `DashboardPage` | Custom compositions for post-login screens |

### TerminalView Changes

- Padding: `px-3 py-2` → `px-5 py-3`
- Font size: hardcoded `11px` → default `13px` via new `fontSize` prop
- Line height: `leading-relaxed` → `lineHeight: 1.7`
- Blank line spacer: `h-3` → `h-4`
- Prompt spacing: wider margins between cwd, glyph, and command text

### Exports

All 8 primitives, 4 templates, and their TypeScript types are exported from the `@scenar/react` public API via `packages/react/src/pages/index.ts`.

## Benefits

- **Scenario authors** get realistic page content with 1 import instead of 50+ lines of inline Tailwind
- **Visual consistency** across all products using Scenar (Stigmer, Planton, future)
- **Composability** — templates cover 70-80% of cases; primitives handle the rest
- **Terminal readability** — text fills the viewport naturally at comfortable sizes
- **Customisability** — `fontSize` prop on TerminalView, slot-based templates with full prop control
- **No new dependencies** — everything uses Tailwind + existing `--scenar-*` tokens

## Impact

- **@scenar/react** — 15 new files (8 primitives, 4 templates, 3 barrel indexes), 2 modified files
- **Existing scenarios** — TerminalView improvements apply automatically; template migration is opt-in
- **API surface** — 12 new component exports + 17 new type exports added to the public API
- **Bundle** — minimal impact; all components are tree-shakeable

## Related Work

- Built on top of the shell view system added in `feat(react): add five new shell views`
- Stigmer scenario migration (authentication-flow-playback, platform-client-token-flow, register-idp-playback, multi-tenant-setup-playback) is deferred until after the next publish/tag
- Planton demos integration is tracked separately

---

**Status**: ✅ Production Ready
**Timeline**: Single session
