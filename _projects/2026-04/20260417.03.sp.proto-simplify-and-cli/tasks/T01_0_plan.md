# T01 Plan — Proto Simplification + Stub Regen + SDK Update + CLI Scaffold

**Status**: APPROVED — ready to execute
**Parent Task**: Product strategy discussion (Scenar is a local-first tool; no DB, no hosted service in Phase 1)

## Decisions Taken (from review)

1. **Proto message rename**: `ScenarioSpec` -> `Scenario`. The message name should just be `Scenario`, not `ScenarioSpec`. File name (`spec.proto` or `scenario.proto`) doesn't matter.
2. **TTS provider**: Start with a **free/open-source TTS** (Echogarden — TypeScript-native, offline, MIT-friendly, no API key needed). OpenAI TTS ($0.015/1K chars) as a paid upgrade later via `--tts openai` flag.
3. **CLI input format**: **YAML only** for v1. No TypeScript scenario loading (requires bundler complexity). Keep it simple.
4. **Product strategy context**: Scenarios live in git, never in a DB. No hosted service for Phase 1. The Stigmer agent (future) is the primary monetization path — it generates scenario PRs against user repos. Scenar stays OSS.

## Motivation

The current proto contract was designed as a Kubernetes-style resource model with:
- A `Scenario` resource envelope (`api_version`, `kind`, `metadata`, `status`)
- A full `commons/` package (7 files: metadata, audit, visibility, kind, field_options, rpc_service_options, pagination)
- CRUD RPCs (`command.proto`, `query.proto`) and render IO (`io.proto`)

This was forward-looking for a hosted Scenar service. But the product decision is clear: **scenarios are files in git, not rows in a database.** The hosted service is Phase 2+ and may never need this exact shape. The overhead hurts today:
- New users see 13 proto files when only 2 matter
- The SDK adapter validates `apiVersion` and `kind` fields that have no purpose in local usage
- Generated stubs include types nobody consumes

## Scope

This task covers 6 concrete work items:

### 1. Delete commons/ entirely

**Files to delete (7):**
- `apis/ai/scenar/commons/resource/enum.proto`
- `apis/ai/scenar/commons/resource/field_options.proto`
- `apis/ai/scenar/commons/resource/kind.proto`
- `apis/ai/scenar/commons/resource/metadata.proto`
- `apis/ai/scenar/commons/resource/rpc_service_options.proto`
- `apis/ai/scenar/commons/resource/status.proto`
- `apis/ai/scenar/commons/rpc/pagination.proto`

**Rationale**: ResourceMetadata (name, slug, id, visibility, labels, annotations, tags, version) is a hosted-service concern. Scenarios in git don't need system-generated IDs, visibility enums, or audit trails. If Phase 2 needs these, they'll be re-introduced with actual requirements.

### 2. Delete service/hosting protos

**Files to delete (4):**
- `apis/ai/scenar/scenario/v1/api.proto` — the `Scenario` resource wrapper (api_version, kind, metadata, spec, status) and `ScenarioStatus`
- `apis/ai/scenar/scenario/v1/command.proto` — `ScenarioCommandController` (create, update, delete, render RPCs)
- `apis/ai/scenar/scenario/v1/query.proto` — `ScenarioQueryController` (get, list RPCs)
- `apis/ai/scenar/scenario/v1/io.proto` — `ScenarioId`, `Scenarios`, `ListScenariosInput`, `RenderInput`, `RenderOutput`, `ScenarioOutputFormat`

**Rationale**: No service to call. CLI operates on files. These RPCs can be re-introduced when a hosted service is built.

### 3. Keep spec.proto + enum.proto, rename message to `Scenario`

**Files to keep (2):**
- `apis/ai/scenar/scenario/v1/spec.proto` — rename message `ScenarioSpec` -> `Scenario`. Keep `ViewportConfig`, `Step`, `StepAction`, all config messages.
- `apis/ai/scenar/scenario/v1/enum.proto` — `ActionType` enum (unchanged)

**Decision**: Message name becomes `Scenario` (not `ScenarioSpec`). File name doesn't matter — can stay `spec.proto` or rename to `scenario.proto`.

### 4. Update buf config

`apis/buf.yaml` — remove lint exceptions that only applied to service RPCs:
- Remove: `RPC_PASCAL_CASE`, `RPC_REQUEST_STANDARD_NAME`, `RPC_RESPONSE_STANDARD_NAME`, `RPC_REQUEST_RESPONSE_UNIQUE`, `SERVICE_SUFFIX`
- Keep: `FIELD_NOT_REQUIRED`, `ENUM_VALUE_UPPER_SNAKE_CASE`, `ENUM_VALUE_PREFIX`, `ENUM_ZERO_VALUE_SUFFIX`, `PACKAGE_VERSION_SUFFIX`

`apis/buf.gen.ts.yaml` — remove the ConnectRPC plugin (no services to generate clients for):
```yaml
# DELETE this plugin block:
- remote: buf.build/connectrpc/es:v1.6.1
  out: stubs/ts
  opt:
    - target=ts
```

### 5. Regenerate stubs and clean up old ones

- Delete all generated stubs under `apis/stubs/{ts,go,python}/ai/scenar/commons/`
- Delete generated stubs for `api_pb`, `command_pb`, `command_connect`, `query_pb`, `query_connect`, `io_pb`
- Run `make protos` from `apis/` to regenerate clean stubs
- Verify: `buf lint` and `buf build` pass clean

### 6. Update @scenar/sdk proto adapter

**`packages/sdk/src/proto/proto-types.ts`:**
- Remove `ProtoScenario` (the `{apiVersion, kind, spec}` wrapper)
- `ProtoScenarioSpec` becomes the top-level accepted type
- All config types stay unchanged

**`packages/sdk/src/proto/load-scenario.ts`:**
- Remove `apiVersion` and `kind` validation (no envelope)
- Accept `ProtoScenarioSpec` directly instead of `ProtoScenario`
- Function signature changes from `loadScenarioFromProto(scenario: ProtoScenario, ...)` to `loadScenarioFromProto(spec: ProtoScenarioSpec, ...)`

**`packages/sdk/src/__tests__/load-scenario.test.ts`:**
- Remove tests for `apiVersion` validation, `kind` validation
- Update all test cases to pass `ProtoScenarioSpec` directly (no envelope wrapper)
- Keep and verify: empty steps rejection, unknown view rejection, action mapping

**`packages/sdk/src/index.ts`:**
- Update exports (remove `ProtoScenario` if exported)

### 7. Scaffold @scenar/cli

**New package**: `packages/cli/`

```
packages/cli/
├── package.json           (@scenar/cli)
├── tsconfig.json
├── src/
│   ├── index.ts           (entry point, commander setup)
│   ├── commands/
│   │   ├── narrate.ts     (scenar narrate <file> --tts openai --out ./narration/)
│   │   └── validate.ts    (scenar validate <file> --json)
│   └── util/
│       ├── load-file.ts   (read .ts or .yaml scenario files)
│       └── tts.ts         (OpenAI TTS client)
├── bin/
│   └── scenar.ts          (shebang entry)
└── README.md
```

**`scenar narrate`:**
1. Read scenario YAML file
2. Extract `narration_text` from each step
3. Generate audio using free offline TTS (Echogarden — TypeScript-native, no API key)
4. Write one `.mp3` per step + `manifest.json` with durations
5. Optional `--tts openai` flag for higher-quality paid TTS (requires `OPENAI_API_KEY`)

**`scenar validate`:**
1. Read scenario YAML file
2. Validate against proto schema constraints (min_items, required fields, etc.)
3. Output human-readable errors (default) or JSON (`--json` flag)
4. Exit code 0 on success, 1 on validation errors

**Dependencies:**
- `commander` — CLI framework
- `@scenar/sdk` — scenario loading + validation
- `echogarden` — free offline TTS (default engine)
- `openai` — optional paid TTS upgrade (peer dependency)
- `yaml` — YAML parsing

## Execution Order

1. Delete proto files (commons/, api.proto, command.proto, query.proto, io.proto)
2. Update buf.yaml and buf.gen.ts.yaml
3. Delete old generated stubs
4. Run `make protos` to regenerate
5. Verify `buf lint` + `buf build`
6. Update SDK proto-types.ts and load-scenario.ts
7. Update SDK tests
8. Run `pnpm -r build` and `pnpm -r test` to verify all packages
9. Scaffold CLI package structure
10. Implement `scenar validate`
11. Implement `scenar narrate`
12. Add CLI to root workspace + verify `pnpm -r build`

## Quality Gate

- [ ] `buf lint` passes
- [ ] `buf build` passes
- [ ] Only 2 proto source files remain: `spec.proto` (or `scenario.proto`) + `enum.proto`
- [ ] Zero `commons/` references in any file
- [ ] `pnpm -r build` — all packages compile clean
- [ ] `pnpm -r test` — all existing tests pass (updated where needed)
- [ ] `scenar validate` works on a sample scenario
- [ ] `scenar narrate` works with OpenAI TTS (manual test with API key)

## Resolved Questions

1. **Rename `spec.proto` to `scenario.proto`?** — File name doesn't matter. Message name: `Scenario` (not `ScenarioSpec`). **DECIDED.**
2. **TTS provider for narrate**: Free offline TTS (Echogarden) as default. OpenAI as optional paid upgrade via `--tts openai`. **DECIDED.**
3. **YAML scenario loading in CLI**: YAML only for v1. No TS loading. **DECIDED.**
