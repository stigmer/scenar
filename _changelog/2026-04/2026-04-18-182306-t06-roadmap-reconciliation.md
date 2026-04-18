# T06 Roadmap Reconciliation — Mark Done, Defer T08

**Date**: April 18, 2026

## Summary

Audited the T06 task ("Rewire Stigmer Demos to Scenar Imports") and confirmed it was completed incrementally during T03 through T07. Updated the project roadmap to reflect actual state: T06 marked DONE, T08 deferred, sub-project `.03` synced to Complete. Cleaned up stale Remotion references in Stigmer's demo tokens.

## Problem Statement

The project roadmap in `next-task.md` showed T06 as PENDING and T08 as PENDING, despite the underlying work having already been completed across prior tasks. The sub-project `20260417.03.sp.proto-simplify-and-cli` was listed as "Active" in the parent while its own `next-task.md` declared itself complete.

### Pain Points

- Roadmap status lagged behind actual codebase state, creating confusion about what to work on next
- Stale Remotion-era comments in Stigmer's `tokens.ts` referenced a deleted video pipeline

## Solution

Performed a thorough audit of both repos to confirm T06 completion, then updated tracking documents and removed dead code references.

## Implementation Details

### Scenar repo (`d5920e8`)

Updated `_projects/2026-04/20260417.02.scenar-product/next-task.md`:
- T06 status: `PENDING` → `DONE (incremental via T03–T07)`
- T06 section: `Current Task` → `Completed`, with summary of evidence (all 30 scenarios on `@scenar/*`, product-specific chrome stays in Stigmer by T04 design decision)
- T08 status: `PENDING` → `DEFERRED — Stigmer-as-consumer already validates; revisit for docs/onboarding`
- Sub-project `.03` status: `Active` → `Complete`

### Stigmer repo (`d72a7f11e`)

Cleaned up `site/src/components/docs/demos/shared/tokens.ts`:
- Removed "video export mode" and "DemoVideo zoom (2x)" references from `DEMO_BROWSER_ZOOM`, `DEMO_SHELL_HEIGHT`, `DEMO_SHELL_HEIGHT_MIN`, `DEMO_BROWSER_SHELL_HEIGHT` comments
- Removed `DEMO_VIDEO_SHELL_HEIGHT` constant (460px) — the Remotion pipeline it served was deleted in T07; video rendering now lives in `@scenar/remotion`

## Audit Evidence (T06 Completion)

| Area | Status |
|------|--------|
| ScenarioPlayer, hooks, Cursor, types | All 30 scenarios import from `@scenar/react` |
| BrowserView, TerminalView, CodeEditorView | Imported from `@scenar/react` |
| Preview MSW + providers | `@scenar/preview/runtime` and `@scenar/preview/connect` |
| Theme CSS | `globals.css` imports `@scenar/react/theme.css` |
| Dependencies | `@scenar/core`, `@scenar/react`, `@scenar/preview` 0.1.12 in site/package.json |
| Remotion pipeline | Deleted from Stigmer in T07 |
| Stale local engine code | None found |

### Correctly stays local in Stigmer (product-specific)

- `views/` — AppShell, ComposerView, ManagementShell, APIExchangeView, ResourceListPage, WidgetsSidebar
- `shared/StigmerDemoViewport.tsx` — thin wrapper over `@scenar/react`'s DemoViewport
- `shared/tokens.ts` — Stigmer-specific zoom/detail CSS classes
- `fixtures/` — Stigmer mock data
- `.scenar/providers.tsx` — Stigmer SDK provider stack

## Benefits

- Roadmap accurately reflects reality — no false "pending" tasks
- Clear that all original extraction goals (T01–T07) are achieved
- T08 deferred with rationale rather than left ambiguously pending

## Impact

Project tracking only. No functional code changes. The `DEMO_VIDEO_SHELL_HEIGHT` removal is dead code cleanup (constant was unused after T07 deleted Stigmer's Remotion pipeline).

---

**Status**: Production Ready
