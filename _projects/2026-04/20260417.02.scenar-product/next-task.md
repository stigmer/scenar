# Next Task: 20260417.02.scenar-product

## Quick Resume Instructions

Drop this file into your conversation to quickly resume work on this project.

## Project: Scenar Product Extraction

**Description**: Extract the demo video framework from Stigmer into a standalone open-source product called Scenar. Users bring their React components, define scenarios declaratively via proto-defined contracts, and get interactive web embeds + pixel-perfect MP4 videos from the same source. Real components, not screenshots. Live demos, not recordings.

**Goal**: Define the Scenar proto contract (separate from Stigmer protos), extract the generic engine, build a React SDK with createScenario(), and rewire Stigmer demos to import from the extracted package.

**Tech Stack**: TypeScript, React, Framer Motion, Remotion, Protobuf (buf)

**Repository**: [scenar-ai/scenar](https://github.com/scenar-ai/scenar) (public, open-source monorepo)

**Local Path**: `/Users/suresh/scm/github.com/scenar-ai/scenar`

## Task Roadmap

| Task | Title | Status | Depends On |
|------|-------|--------|------------|
| T01 | Define Scenar Proto Contract | DONE | — |
| T02 | Scaffold Directory & Buf Configuration | DONE (via T01) | T01 |
| T03 | Engine Extraction (zero @stigmer/* imports) | DONE | T02 |
| T04 | Shells Extraction | DONE | T03 |
| T05 | SDK — createScenario() | DONE | T01, T03 |
| T06 | Rewire Stigmer Demos to Scenar Imports | PENDING | T03, T04 |
| T07 | Remotion Video Pipeline Integration | PENDING | T03, T06 |
| T08 | Standalone Example (validates extraction) | PENDING | T05, T06 |

## Completed: T01 — Define Scenar Proto Contract

**Status**: DONE — Committed and pushed to scenar-ai/scenar (e5e9a32)

**What was built**:
- 13 proto source files (6 scenario + 7 commons)
- Commons resource patterns (metadata, audit, visibility, kind, field options, pagination)
- Buf module `buf.build/scenar/apis` with standalone config
- Codegen templates for TypeScript, Go, Python
- Makefiles (root + apis) — `make protos` generates 72 stub files
- `buf lint` and `buf build` pass clean

**Design decisions applied**:
1. **Separate GitHub repo**: `scenar-ai/scenar` (not a subdirectory of stigmer)
2. **Zero Stigmer imports**: Scenar's own commons (`ai.scenar.commons.*`)
3. **Interactions embedded in Step**: Not a separate `map<int32, StepInteractions>` — each step owns its interactions for better YAML ergonomics
4. **No CursorStyle enum**: Cursor visual style is an engine concern, not scenario data
5. **No multi-org**: `ResourceMetadata` has no `org` field initially
6. **Forward-looking services**: command.proto and query.proto define the API for a future hosted Scenar service

## Completed: T03 — Engine Extraction

**Status**: DONE — 41 source files, 2,873 LOC, 35 tests passing

**What was built**:

### @scenar/core (pure TypeScript, zero dependencies)
- Scenario types (`ScenarioStep<T>`, `StepAction`, `StepInteractions`)
- Timeline computation (`computeStepTimeline`, `deriveStepFromTime`, `getStepDurationMs`)
- Timing constants (5 named constants)
- DOM scroll utilities, cursor position math
- Centralized data-attribute contract (`CURSOR_TARGET_ATTRIBUTE`, etc.)
- 27 unit tests across 6 test files

### @scenar/react (React + Framer Motion)
- ScenarioPlayer decomposed from 681 LOC -> 8 files (largest: 243 LOC)
- useStepInteractions decomposed from 997 LOC -> 15 files (largest: 147 LOC)
- DemoViewport decoupled — all layout constants are optional props with engine defaults
- useNarrationManifest URL convention configurable
- Cursor icons use CSS custom properties for host-app theming
- 8 tests for effects and coordinator

**Design decisions applied**:
1. **Layered packages**: `@scenar/core` (pure TS) + `@scenar/react` (React). Core has zero framework deps.
2. **Engine stays TS-native**: `ScenarioStep<T>` generic. Proto adapter deferred to T05.
3. **DemoViewport configurable**: canonicalWidth, minZoom, shellHeight, wrapperClassName are optional props.
4. **Per-action effect files**: Adding a new interaction type is a one-file change.
5. **Conditional hooks in useStepInteractions**: Browser vs. video path selected by TimeSource presence.

## Completed: T04 — Shells Extraction

**Status**: DONE

**What was built**:
- 4 chrome primitives extracted: `BrowserView` (116 LOC), `TerminalView` (119 LOC), `CodeEditorView` (219 LOC), `PulseHighlight` (30 LOC)
- Minimal `--scenar-*` token layer: 3 CSS custom properties (`--scenar-surface`, `--scenar-border`, `--scenar-foreground`) under `@layer scenar` with `.scenar` / `.scenar.dark` scoping
- `@scenar/react/theme.css` export path for consumer apps
- 13 new tests across 4 test files; total package tests: 48
- 9 source files, 543 LOC; 4 test files, 162 LOC

**Design decisions applied**:
1. **Primitives only** — `AppShell`, `ManagementShell`, `APIExchangeView` stay in Stigmer (too product-specific)
2. **3 tokens, not a full palette** — only tokens consumed by shipped components; future tokens are per-component decisions
3. **`@layer scenar`** — low-priority CSS layer; host styles win without `!important`
4. **Interior chrome colours preserved** — Chrome/Terminal/VS Code palette stays literal (mimics real software)
5. **Zero host-Tailwind-token dependency** — shells use CSS vars, not `bg-card`/`border-border` utility classes

## Completed: T05 — SDK `createScenario()`

**Status**: DONE — 7 source files, 472 LOC. 3 test files, 554 LOC. 31 tests passing.

**What was built**:
- Engine reconciliation: inlined `ScenarioStep.interactions`, aligned ActionType strings with proto enum names (snake_case)
- `@scenar/sdk` package: `createScenario()` typed TS-first builder + `loadScenarioFromProto()` proto adapter
- SDK is framework-agnostic (zero React dependency)
- `InvalidScenarioError` with path-scoped error reporting
- Structural proto types (no dependency on generated stubs)

**Design decisions**: DD-006 through DD-009 (see `design-decisions/`)

## Current Task: T06 — Rewire Stigmer Demos to Scenar Imports

**Status**: PENDING — Ready to start (T03, T04, T05 are done)

## Key Design Decisions

1. **Separate GitHub repo**: `scenar-ai/scenar` under the `scenar-ai` GitHub organization. Domain: scenar.ai.
2. **Proto-first (hybrid approach)**: Proto defines the scenario contract. TypeScript types generated from protos. Users author in TS (with generated types) or YAML — both validate against the same schema.
3. **Zero Stigmer dependencies**: Scenar protos import only `buf/validate` and `google/protobuf`. Commons are Scenar's own (`ai.scenar.commons.*`).
4. **Embedded interactions**: Step owns its interactions. No separate interaction map keyed by step index.
5. **View is an opaque string**: The `view` field maps to React components via the scenario author's render function. Shells (AppShell, BrowserView) are product-specific, not modeled in the proto.
6. **Forward-looking services**: command.proto and query.proto define the API surface for a future hosted Scenar platform.
7. **Layered packages**: `@scenar/core` (pure TS, zero deps) + `@scenar/react` (React playback). `@scenar/remotion` and `@scenar/sdk` deferred to T07 and T05 respectively.
8. **Engine stays TypeScript-native**: `ScenarioStep<T>` with generic data payload. Proto mapping in `@scenar/sdk` (T05).

## Essential Files to Review

### Scenar Repository
```
/Users/suresh/scm/github.com/scenar-ai/scenar/
├── Makefile
├── package.json, pnpm-workspace.yaml, tsconfig.*.json
├── apis/                            (proto contract — T01)
│   ├── ai/scenar/{scenario,commons}/
│   └── stubs/{ts,go,python}/
└── packages/                        (engine — T03, SDK — T05)
    ├── core/                        (@scenar/core — pure TS types, timing, utilities)
    │   └── src/{scenario,narration,timeline,timing,dom,cursor,viewport,targeting}/
    ├── react/                       (@scenar/react — React components and hooks)
    │   └── src/{player,cursor,viewport,interactions,narration,time,video,playback}/
    └── sdk/                         (@scenar/sdk — typed authoring surface — T05)
        └── src/{author,proto,__tests__}/
```

### Task Plans
```
/Users/suresh/scm/github.com/scenar-ai/scenar/_projects/2026-04/20260417.02.scenar-product/tasks/
```

### Knowledge Folders
- **Design Decisions**: `/Users/suresh/scm/github.com/scenar-ai/scenar/_projects/2026-04/20260417.02.scenar-product/design-decisions/`
- **Coding Guidelines**: `/Users/suresh/scm/github.com/scenar-ai/scenar/_projects/2026-04/20260417.02.scenar-product/coding-guidelines/`
- **Wrong Assumptions**: `/Users/suresh/scm/github.com/scenar-ai/scenar/_projects/2026-04/20260417.02.scenar-product/wrong-assumptions/`
- **Don't Dos**: `/Users/suresh/scm/github.com/scenar-ai/scenar/_projects/2026-04/20260417.02.scenar-product/dont-dos/`
- **Checkpoints**: `/Users/suresh/scm/github.com/scenar-ai/scenar/_projects/2026-04/20260417.02.scenar-product/checkpoints/`

### Existing Shell Components (Extraction Source for T04 — in stigmer repo)
- **Views**: `/Users/suresh/scm/github.com/stigmer/stigmer/site/src/components/docs/demos/views/`
- **Shared**: `/Users/suresh/scm/github.com/stigmer/stigmer/site/src/components/docs/demos/shared/`

### Related Project (Demo Framework Hardening — in stigmer repo)
- **Next task**: `/Users/suresh/scm/github.com/stigmer/stigmer/_projects/2026-04/20260416.02.demo-framework-hardening/next-task.md`
- **Coding guidelines**: `/Users/suresh/scm/github.com/stigmer/stigmer/_projects/2026-04/20260416.02.demo-framework-hardening/coding-guidelines/`
- **Design decisions**: `/Users/suresh/scm/github.com/stigmer/stigmer/_projects/2026-04/20260416.02.demo-framework-hardening/design-decisions/`

## Resume Checklist

1. [ ] Read the latest checkpoint from `checkpoints/` (T03.md has engine extraction details)
2. [ ] Check current task status in `tasks/`
3. [ ] Review design decisions in `design-decisions/`
4. [ ] Check coding guidelines in `coding-guidelines/`
5. [ ] Review lessons in `wrong-assumptions/` and `dont-dos/`
6. [ ] Continue with the current task

## Quick Commands

- "Continue with T04" — Start the shells extraction
- "Show project status" — Get overview of progress
- "Create checkpoint" — Save current progress
- "Review guidelines" — Check established patterns

---

*This file provides direct paths to all project resources for quick context loading.*
