# Next Task: 20260417.03.sp.proto-simplify-and-cli

## RULES OF ENGAGEMENT - READ FIRST

**When this file is loaded in a new conversation, the AI MUST:**

1. **DO NOT AUTO-EXECUTE** - Never start implementing without explicit user approval
2. **GATHER CONTEXT SILENTLY** - Read all project files without outputting
3. **PRESENT STATUS SUMMARY** - Show what's done, what's pending, agreed next steps
4. **SHOW OPTIONS** - List recommended and alternative actions
5. **WAIT FOR DIRECTION** - Do NOT proceed until user explicitly confirms

### Required Status Summary Format

When resuming this sub-project, present:

- **Parent Project**: 20260417.02.scenar-product
- **Overall Objective**: Simplify Scenar protos + scaffold CLI
- **What's Been Completed**: [Key milestones]
- **What's Pending**: [Remaining work]
- **Agreed Focus for This Session**: [From previous session]
- **Options**: A (Recommended), B, C...

WAIT for user to say "proceed", "go", or choose an option.

---

## Parent Project

**Parent**: 20260417.02.scenar-product
**Parent Next Task**: `_projects/2026-04/20260417.02.scenar-product/next-task.md`
**Spawned From Task**: Product strategy discussion

### Inherited Knowledge (CHECK THESE FIRST)

When resuming this sub-project, also review the parent's knowledge folders
for decisions, guidelines, and lessons that apply across all sub-projects:

- Parent Design Decisions: `_projects/2026-04/20260417.02.scenar-product/design-decisions/`
- Parent Coding Guidelines: `_projects/2026-04/20260417.02.scenar-product/coding-guidelines/`
- Parent Wrong Assumptions: `_projects/2026-04/20260417.02.scenar-product/wrong-assumptions/`
- Parent Don't Dos: `_projects/2026-04/20260417.02.scenar-product/dont-dos/`

---

## Quick Resume Instructions

Drop this file into your conversation to quickly resume work on this sub-project.

## Sub-Project: Proto Simplification + CLI Scaffolding

**Description**: Strip the Scenar proto contract from a Kubernetes-style resource model (api_version, kind, metadata, status, CRUD RPCs, commons/) down to a flat, user-friendly scenario definition. Then scaffold `@scenar/cli` with the `narrate` command.

**Goal**: A single clean `scenario.proto` that users can understand in 2 minutes, plus a working CLI that can generate narration audio from scenario files.

**Repository**: [scenar-ai/scenar](https://github.com/scenar-ai/scenar)
**Local Path**: `/Users/suresh/scm/github.com/scenar-ai/scenar`

## Current State

- **Status**: T02 complete
- **Last Session**: April 18, 2026 — T02 CLI scaffolding (validate + narrate) completed
- **Active Task**: None — sub-project complete
- **Commit**: `21acbeb` — `refactor(apis,sdk): simplify proto contract to scenario-only definition` (T01)
- **T02**: Uncommitted — `scenar` CLI package scaffolded with validate + narrate commands

## Session Progress (2026-04-18)

### Completed: T01 Steps 1-8 (Proto Simplification + SDK Update)

- Deleted 11 proto source files (7 commons + 4 service)
- Renamed `spec.proto` → `scenario.proto`, message `ScenarioSpec` → `Scenario`
- Simplified `buf.yaml` (removed 6 RPC/service lint exceptions)
- Removed gRPC plugins from Go and Python gen configs, ConnectRPC plugin from TS gen config
- Regenerated stubs for all three languages (TS, Go, Python) — from ~70 files down to 11
- Updated SDK adapter: deleted `ProtoScenario` envelope type, renamed `ProtoScenarioSpec` → `ProtoScenario`
- Removed `apiVersion`/`kind` envelope validation from `loadScenarioFromProto`
- Updated all tests (removed 3 envelope tests, flattened remaining 8)
- Verified: `buf lint`, `buf build`, `pnpm -r build`, `pnpm -r test` (76/76 tests pass)

### Decisions Made This Session

1. **Rename file too**: `spec.proto` → `scenario.proto` (not just the message) — once the envelope is gone, "spec" implies a sub-part of a larger resource, which is misleading
2. **Remove gRPC plugins from Go and Python configs** (not just ConnectRPC from TS) — no services remain, keep the toolchain clean
3. **Remove `PACKAGE_VERSION_SUFFIX` lint exception** — only `commons/` lacked version suffixes, and it's deleted

### Observations

- `@bufbuild/protobuf` is listed in `packages/sdk/package.json` as a dependency but never imported in source — dead dependency, could be removed in a future cleanup pass

### Completed: T02 — CLI Scaffolding (validate + narrate)

- Scaffolded `packages/cli/` with npm name `scenar` (unscoped), binary `scenar`
- Implemented YAML scenario loader with snake_case → camelCase key conversion
- Implemented scenario validator covering all `buf.validate` proto constraints
- Implemented `scenar validate <file>` with human-readable and `--json` output
- Implemented TTS provider abstraction with Echogarden (optional peer dep, GPL v3) and OpenAI providers
- Implemented `scenar narrate <file>` with per-step audio generation, progress output, and manifest.json
- Added `PROTO_ACTION_TYPE` and `ProtoActionTypeValue` exports to `@scenar/sdk`
- 48 new tests (6 test files), all passing
- Total: 124 tests across 4 packages (27 core + 28 sdk + 21 react + 48 cli)
- Wired into workspace: root `tsconfig.json` references, pnpm workspace auto-discovery

### Decisions Made: T02

1. **Package name**: `scenar` (unscoped) — matches Prisma/Turbo/Storybook pattern where the CLI is the product name
2. **YAML convention**: snake_case field names in YAML (proto-native), camelCase internally
3. **Echogarden as optional peer dependency**: GPL v3 license conflict with Apache-2.0; user installs explicitly
4. **Validation in CLI**: Lives in `packages/cli/src/validate/`, not in SDK (different concern layer)
5. **Provider resolution at command handler level**: `runNarrate` accepts a `TtsProvider` for testability

## Decisions Taken (All Sessions)

1. **Proto message rename**: `ScenarioSpec` -> `Scenario` (the message name, not the file name)
2. **Proto file rename**: `spec.proto` -> `scenario.proto` (decided session 2026-04-18)
3. **TTS provider**: Free offline TTS (Echogarden) as default. OpenAI TTS as optional paid upgrade via `--tts openai` flag.
4. **CLI input**: YAML only for v1. No TypeScript scenario loading.
5. **No DB**: Scenarios live in git. No hosted service for Phase 1.
6. **Monetization**: Stigmer agent generates scenario PRs against user repos. Scenar stays OSS.
7. **Shells stay in user-land**: Scenar ships generic chrome (BrowserView, TerminalView, CodeEditorView). Product-specific shells (AppShell, ManagementShell) are user-written "presentational twins."
8. **Embed model**: The embed is a compiled artifact built in the user's environment (like Docker). CDN only hosts the output. User's private code never leaves their machine/CI.
9. **gRPC plugins removed**: All gRPC/ConnectRPC plugins removed from buf gen configs (no services remain)
10. **CLI package name**: `scenar` (unscoped npm name), directory `packages/cli/`
11. **YAML uses snake_case**: Scenario YAML files use proto-native snake_case field names
12. **Echogarden optional**: GPL v3 dependency made optional peer dep to keep CLI Apache-2.0

## Task Roadmap

| Task | Title | Status | Depends On |
|------|-------|--------|------------|
| T01 | Proto simplification + stub regen + SDK adapter update | DONE | — |
| T02 | CLI scaffolding (`scenar` with validate + narrate) | DONE | T01 |

## What's Next

Sub-project goals achieved. Both T01 (proto simplification) and T02 (CLI scaffolding) are complete. Potential follow-ups:

- **Commit T02 changes** — all changes are uncommitted
- **End-to-end narrate test** — requires Echogarden install or OpenAI API key
- **Remove dead `@bufbuild/protobuf` dependency** from `@scenar/sdk`
- **Add more CLI commands** as the product evolves

### CLI Package Structure (Built)
```
packages/cli/
├── package.json                ← scenar (unscoped)
├── tsconfig.json
├── bin/scenar.ts               ← shebang entry
├── src/
│   ├── index.ts                ← commander setup
│   ├── commands/
│   │   ├── validate.ts         ← YAML schema validation
│   │   └── narrate.ts          ← TTS audio generation
│   ├── validate/
│   │   └── scenario-validator.ts ← proto constraint rules
│   ├── tts/
│   │   ├── types.ts            ← TtsProvider interface + manifest types
│   │   ├── echogarden.ts       ← optional peer dep (GPL v3)
│   │   ├── openai.ts           ← requires OPENAI_API_KEY
│   │   └── resolve-provider.ts ← factory with fallback guidance
│   ├── util/
│   │   └── load-yaml.ts        ← YAML reader + snake_case→camelCase
│   └── __tests__/ (6 files, 48 tests)
└── examples/demo.yaml
```

### Proto Structure (Current — After T01)
```
apis/ai/scenar/scenario/v1/
├── scenario.proto              ← Scenario, ViewportConfig, Step, StepAction, configs
└── enum.proto                  ← ActionType (unchanged)
```

### SDK Structure (Current — After T01)
```
packages/sdk/src/
├── proto/
│   ├── proto-types.ts          ← ProtoScenario (was ProtoScenarioSpec), unchanged sub-types
│   ├── load-scenario.ts        ← accepts ProtoScenario directly (no envelope)
│   ├── action-mapper.ts        ← unchanged
│   └── errors.ts               ← unchanged
├── author/
│   ├── types.ts                ← unchanged
│   └── createScenario.ts       ← unchanged
├── __tests__/
│   ├── load-scenario.test.ts   ← 8 tests (envelope tests removed)
│   ├── action-mapper.test.ts   ← 14 tests (unchanged)
│   └── createScenario.test.ts  ← 6 tests (unchanged)
└── index.ts                    ← ProtoScenarioSpec export removed
```

## Resume Checklist

1. [ ] Read this file for session context
2. [ ] Check parent design decisions in `_projects/2026-04/20260417.02.scenar-product/design-decisions/`
3. [ ] Check `tasks/T01_0_plan.md` for T01 scope reference (completed)
4. [ ] Plan T02 (CLI scaffolding) before implementing

---

*This file provides direct paths to all sub-project resources for quick context loading.*
