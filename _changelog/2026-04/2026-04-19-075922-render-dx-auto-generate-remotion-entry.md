# `scenar render` DX: Auto-Generate Remotion Entry and Webpack Override Passthrough

**Date**: April 19, 2026

## Summary

Eliminated the 4-file / ~280-line Remotion boilerplate tax from `scenar render` by having the CLI auto-generate a temporary Remotion entry point from scenario conventions, and pass through webpack overrides via a new `--webpack-override` flag. A consumer can now render a scenario video with zero Remotion code.

## Problem Statement

When integrating Scenar into the Planton project to produce a demo video, `scenar render` required the consumer to hand-author 4 extra files (~280 lines) of pure Remotion ceremony that duplicated information the CLI already had:

### Pain Points

- The render function was written identically in two places (scenario `index.tsx` and a separate Remotion composition file)
- A manual `bundle.ts` reassembled `ScenarioBundle` from data the CLI already loaded
- A `remotion/` directory with `index.tsx` (registerRoot one-liner) and `Root.tsx` (Composition registration) was pure ceremony
- The CLI did not expose `webpackOverride` to `@remotion/bundler.bundle()`, forcing consumers to bypass the CLI entirely with a 93-line custom render script

## Solution

Two changes to the CLI render command:

1. **Auto-generate the Remotion entry**: When `--entry` is not provided, the CLI detects a `renderStep` export in the scenario directory (checking `render.tsx` first, then `index.tsx`), locates `.scenar/providers.tsx` by walking up the directory tree, and generates a temporary Remotion entry file inside the scenario directory. The generated entry imports the render function, steps, narration manifest, and providers using absolute paths, calculates the timeline, registers a Composition, and calls `registerRoot`.

2. **`--webpack-override` passthrough**: A new CLI flag accepts a path to a module that default-exports (or named-exports `webpackOverride`) a `WebpackOverrideFn`. The function is dynamic-imported and passed through to `bundler.bundle()`.

## Implementation Details

### New files in `packages/cli/src/render/`:

- **`generate-entry.ts`** -- Pure function that produces the Remotion entry file content as a string. Uses namespace imports with duck-typing for the steps array (handles any export name), absolute paths for all imports, and conditionally includes providers wrapping. No side effects.

- **`resolve-providers.ts`** -- Walks up from the scenario directory to find `.scenar/providers.tsx`. Returns the absolute path or null. Same discovery pattern as `scenar preview`.

- **`detect-render-export.ts`** -- Checks for `render.tsx` first (recommended), then `render.ts`, `index.tsx`, `index.ts`. Uses source-level regex to detect the `renderStep` export rather than dynamic-importing the file (which would pull in all transitive React/MUI/MSW dependencies at CLI time).

### Key design decisions:

- **`render.tsx` convention**: During e2e testing, we discovered that importing `renderStep` from `index.tsx` pulls in browser-only dependencies (`@scenar/preview/runtime` -> MSW/interceptors) that break the Remotion webpack bundle. The solution: a dedicated `render.tsx` that only imports view components. The CLI checks for this file first.

- **Temp file in scenario directory**: The generated entry is written to `<scenario-dir>/.scenar-render/index.tsx` (not `/tmp/`). Webpack resolves `node_modules` by walking up from the entry file, so placing it inside the project tree ensures standard module resolution works. The directory is cleaned up in a `finally` block.

- **Source-level export detection**: Rather than dynamic-importing the scenario file (which would require resolving the entire React/MUI dependency tree at CLI time), the CLI reads the file source and uses regex to detect `export function renderStep` patterns.

## Benefits

- **Consumer writes 1 file instead of 5**: A dedicated `render.tsx` (~90 lines) replaces `bundle.ts` + `remotion/index.tsx` + `remotion/Root.tsx` + `remotion/compositions/*Composition.tsx` + `scripts/render-video.ts`
- **No duplicate render function**: The render logic exists in exactly one place
- **`--entry` escape hatch preserved**: Consumers who need full control over the Remotion project can still use `--entry` and the CLI skips generation entirely
- **Existing tests unaffected**: All 63 CLI tests pass, typecheck is clean

## Impact

- **CLI users**: Can now render scenario videos with zero Remotion boilerplate
- **Planton demos**: Eliminated 5 ceremony files, reduced to `render.tsx` + `webpack-override.ts`
- **No changes to `@scenar/core`, `@scenar/react`, `@scenar/remotion`, or `@scenar/preview`**: The gap was entirely in the CLI

## Related Work

- Originated from the `scenar render` DX gap document (`_projects/2026-04/20260418.scenar-render-dx-gap.md`)
- Audio path resolution (narration files in `public/` vs scenario directory) remains a secondary issue for a follow-up

---

**Status**: Production Ready
**Timeline**: Single session
