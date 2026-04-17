# Chrome Shell Primitives Extraction & Theme Token Foundation

**Date**: April 17, 2026

## Summary

Extracted four generic chrome shell components (BrowserView, TerminalView, CodeEditorView, PulseHighlight) from the Stigmer docs site into `@scenar/react`, and introduced a minimal `--scenar-*` CSS custom property token layer that makes shells render correctly in any host application without depending on the host's Tailwind config or design system.

## Problem Statement

The Scenar playback engine (extracted in T03) renders scenario content inside visual "shells" — browser windows, terminal emulators, code editors — that provide familiar context to the viewer. These shells lived in the Stigmer site codebase and were tightly coupled to Stigmer's shadcn/Tailwind theme tokens (`bg-card`, `border-border`, `text-foreground`). A third-party host app embedding `@scenar/react` would see broken, unstyled shell chrome.

### Pain Points

- Shells used Tailwind utility classes that resolve against host-specific CSS variables — unusable outside Stigmer
- Default prop values contained Stigmer vocabulary (`~/stigmer-federation`, `stigmer-federation`)
- No theming contract existed for Scenar — each component used a different ad-hoc approach
- Shell height was driven by `--demo-shell-height`, a Stigmer-internal convention

## Solution

Port the four industry-standard chrome primitives (browser, terminal, code editor, highlight ring) into `@scenar/react` with all host-theme-dependent styles replaced by `--scenar-*` CSS custom properties. Introduce a minimal, layered CSS token file that provides sensible light/dark defaults while allowing any host app to override.

## Implementation Details

### Components extracted (9 source files, 543 LOC)

| Component | LOC | What it renders |
|---|---|---|
| `BrowserView` | 116 | Chrome-style tab strip, address bar, traffic lights, animated content area |
| `TerminalView` | 119 | macOS Terminal title bar, tab bar, coloured prompt/output/error lines |
| `CodeEditorView` | 219 | VS Code activity bar, optional file explorer with indent guides, tab bar, line-number gutter with highlight support |
| `PulseHighlight` | 30 | Animated border ring overlay for drawing attention to interactive elements |

### Theme token layer (3 tokens, scoped)

```css
@layer scenar {
  .scenar     { --scenar-surface: #fff; --scenar-border: #e5e7eb; --scenar-foreground: #0f172a; }
  .scenar.dark { --scenar-surface: #0f172a; --scenar-border: #1e293b; --scenar-foreground: #f8fafc; }
}
```

- `@layer scenar` — low-priority CSS layer; host styles win without `!important`
- `.scenar` container scope — mirrors Stigmer's `.stgm` / `@layer stgm` pattern
- Exported via `@scenar/react/theme.css` — consumers add one import

### Key transformations

- `border-border` → `borderColor: "var(--scenar-border)"`
- `bg-background` → `background: "var(--scenar-surface)"`
- `border-foreground` → `borderColor: "var(--scenar-foreground, currentColor)"`
- `--demo-shell-height` → `--scenar-shell-height` (already produced by `DemoViewport`)
- Interior chrome colours (Chrome dark theme, Terminal Dracula palette, VS Code dark) preserved as hardcoded literals — they mimic real software, not the host theme

### Tests (4 test files, 162 LOC, 13 new tests)

Shallow-render tests using `@testing-library/react` covering URL rendering, tab title derivation, default props, explorer panel visibility, line highlighting, aria-hidden attributes, and CSS variable usage.

## Benefits

- **Host-agnostic shells**: Any React app can render Scenar shells by importing `@scenar/react/theme.css` — no shadcn, no Tailwind config, no Stigmer dependencies
- **Precedent-setting theming contract**: The `--scenar-*` / `@layer scenar` / `.scenar` pattern is now the established convention for every future Scenar component
- **Clean public API surface**: Only 4 components, 3 types, 3 constants, and 1 CSS export — deliberately minimal
- **Zero Stigmer leakage**: No `@stigmer` imports, no `stigmer-federation` defaults, no host-Tailwind utility classes in the shipped code

## Impact

- `@scenar/react` public API grows from engine-only (player, cursor, viewport, interactions) to engine + chrome shells
- Total package test count: 48 (27 core + 21 react)
- Total `@scenar/react` source: ~50 files, ~3,400 LOC
- Sets the theming precedent that T05 (SDK), T06 (Stigmer rewiring), and all future packages will follow

## Related Work

- **T01**: Proto contract (provides the scenario data model)
- **T03**: Engine extraction (provides the playback runtime these shells integrate with)
- **T05** (next): SDK `createScenario()` — bridges proto types to the engine
- **T06** (future): Rewire Stigmer demos to import shells from `@scenar/react`

---

**Status**: ✅ Production Ready
**Timeline**: Single session
