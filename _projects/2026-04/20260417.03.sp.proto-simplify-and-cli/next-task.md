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

- **Status**: In progress
- **Last Session**: April 18, 2026 — T01 proto simplification (steps 1-8) completed
- **Active Task**: T01 — CLI scaffolding portion (steps 9-12) is next
- **Commit**: `21acbeb` — `refactor(apis,sdk): simplify proto contract to scenario-only definition`

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

## Task Roadmap

| Task | Title | Status | Depends On |
|------|-------|--------|------------|
| T01 | Proto simplification + stub regen + SDK adapter update | DONE | — |
| T02 | CLI scaffolding (`@scenar/cli` with validate + narrate) | NEXT | T01 |

## What's Next: T02 — CLI Scaffolding

### @scenar/cli

- `scenar narrate <scenario.yaml>` — reads scenario YAML, extracts `narration_text` per step, generates audio via free offline TTS (Echogarden), writes .mp3 + manifest.json. Optional `--tts openai` for paid higher-quality voice.
- `scenar validate <scenario.yaml>` — validates a YAML scenario against the proto schema, returns human-readable errors (or JSON with `--json`).

### Package Structure to Scaffold
```
packages/cli/
├── package.json                ← @scenar/cli
├── tsconfig.json
├── bin/scenar.ts               ← shebang entry
├── src/
│   ├── index.ts                ← commander setup
│   ├── commands/
│   │   ├── narrate.ts          ← free TTS (Echogarden) default, OpenAI upgrade
│   │   └── validate.ts         ← YAML validation
│   └── util/
│       ├── load-yaml.ts        ← YAML scenario file reader
│       └── tts.ts              ← TTS abstraction (Echogarden default, OpenAI optional)
└── README.md
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
