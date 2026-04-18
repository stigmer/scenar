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

## Decisions Taken

1. **Proto message rename**: `ScenarioSpec` -> `Scenario` (the message name, not the file name)
2. **TTS provider**: Free offline TTS (Echogarden) as default. OpenAI TTS as optional paid upgrade via `--tts openai` flag.
3. **CLI input**: YAML only for v1. No TypeScript scenario loading.
4. **No DB**: Scenarios live in git. No hosted service for Phase 1.
5. **Monetization**: Stigmer agent generates scenario PRs against user repos. Scenar stays OSS.
6. **Shells stay in user-land**: Scenar ships generic chrome (BrowserView, TerminalView, CodeEditorView). Product-specific shells (AppShell, ManagementShell) are user-written "presentational twins."
7. **Embed model**: The embed is a compiled artifact built in the user's environment (like Docker). CDN only hosts the output. User's private code never leaves their machine/CI.

## Task Roadmap

| Task | Title | Status | Depends On |
|------|-------|--------|------------|
| T01 | Proto simplification + stub regen + SDK adapter update + CLI scaffold | APPROVED | — |

## What's Changing (Proto Simplification)

### Files to DELETE

**Proto source files (7 files):**
- `apis/ai/scenar/commons/resource/enum.proto` (ResourceVisibility, ResourceEventType)
- `apis/ai/scenar/commons/resource/field_options.proto` (computed, immutable field options)
- `apis/ai/scenar/commons/resource/kind.proto` (ResourceKind enum)
- `apis/ai/scenar/commons/resource/metadata.proto` (ResourceMetadata, ResourceMetadataVersion)
- `apis/ai/scenar/commons/resource/rpc_service_options.proto` (resource_kind service option)
- `apis/ai/scenar/commons/resource/status.proto` (ResourceAudit, ResourceAuditStatus)
- `apis/ai/scenar/commons/rpc/pagination.proto` (PageInfo)

**Proto files to delete (service/hosting concerns):**
- `apis/ai/scenar/scenario/v1/command.proto` (ScenarioCommandController)
- `apis/ai/scenar/scenario/v1/query.proto` (ScenarioQueryController)
- `apis/ai/scenar/scenario/v1/io.proto` (ScenarioId, Scenarios, ListScenariosInput, RenderInput/Output)
- `apis/ai/scenar/scenario/v1/api.proto` (Scenario resource envelope with api_version/kind/metadata/status)

**All generated stubs** in `apis/stubs/{ts,go,python}/` for deleted protos.

### Files to KEEP (and simplify)

- `apis/ai/scenar/scenario/v1/spec.proto` — ScenarioSpec, Step, StepAction, configs (KEEP AS-IS, already clean)
- `apis/ai/scenar/scenario/v1/enum.proto` — ActionType enum (KEEP AS-IS)

### Downstream Updates

- `packages/sdk/src/proto/proto-types.ts` — remove `ProtoScenario` (apiVersion/kind wrapper), make `ProtoScenarioSpec` the top-level type
- `packages/sdk/src/proto/load-scenario.ts` — simplify to accept spec directly (no envelope validation)
- `packages/sdk/src/__tests__/load-scenario.test.ts` — remove envelope tests, test spec-level loading
- buf config files — remove commons module references

## What's New (CLI)

### @scenar/cli

- `scenar narrate <scenario.yaml>` — reads scenario YAML, extracts `narration_text` per step, generates audio via free offline TTS (Echogarden), writes .mp3 + manifest.json. Optional `--tts openai` for paid higher-quality voice.
- `scenar validate <scenario.yaml>` — validates a YAML scenario against the proto schema, returns human-readable errors (or JSON with `--json`).

## Essential Files to Review

### Current Proto Structure
```
apis/ai/scenar/
├── commons/                    ← DELETE entirely
│   ├── resource/               ← 6 files (metadata, audit, visibility, kind, field_options, rpc_service_options)
│   └── rpc/                    ← 1 file (pagination)
└── scenario/v1/
    ├── api.proto               ← DELETE (Scenario resource envelope)
    ├── command.proto            ← DELETE (CRUD RPCs)
    ├── query.proto              ← DELETE (query RPCs)
    ├── io.proto                 ← DELETE (IDs, lists, render IO)
    ├── spec.proto               ← KEEP (ScenarioSpec — the core)
    └── enum.proto               ← KEEP (ActionType)
```

### Target Proto Structure
```
apis/ai/scenar/scenario/v1/
├── spec.proto                  ← message renamed: ScenarioSpec -> Scenario
└── enum.proto                  ← ActionType (unchanged)
```

### SDK Files to Update
```
packages/sdk/src/
├── proto/
│   ├── proto-types.ts          ← simplify (remove ProtoScenario envelope, rename ProtoScenarioSpec -> ProtoScenario)
│   ├── load-scenario.ts        ← simplify (accept spec directly, no envelope validation)
│   ├── action-mapper.ts        ← unchanged
│   └── errors.ts               ← unchanged
├── __tests__/
│   └── load-scenario.test.ts   ← update tests (remove apiVersion/kind tests)
└── index.ts                    ← update exports
```

### New Package to Scaffold
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

## Resume Checklist

1. [ ] Read the latest task from `tasks/`
2. [ ] Check parent design decisions in `_projects/2026-04/20260417.02.scenar-product/design-decisions/`
3. [ ] Check parent coding guidelines
4. [ ] Continue with the current task

---

*This file provides direct paths to all sub-project resources for quick context loading.*
