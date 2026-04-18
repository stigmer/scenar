# Proto Simplification: From Kubernetes-Style Resource Model to Scenario-Only Definition

**Date**: April 18, 2026

## Summary

Stripped the Scenar proto contract from a 13-file Kubernetes-style resource model (commons/, resource envelope, CRUD/query RPCs) down to the 2 files that Phase 1 actually needs: `scenario.proto` and `enum.proto`. Updated the SDK adapter to accept the scenario directly without an envelope, and removed all gRPC/ConnectRPC service generation from the buf toolchain. Net result: -5,159 lines across 88 files.

## Problem Statement

The proto contract was designed for a future hosted Scenar service — a full resource model with metadata, audit trails, visibility controls, CRUD RPCs, query controllers, and pagination. None of this is needed in Phase 1, where scenarios are YAML files that live in git.

### Pain Points

- New users saw 13 proto files when only 2 mattered (`spec.proto` and `enum.proto`)
- The SDK adapter validated `apiVersion` and `kind` fields that serve no purpose in local-first usage
- Generated stubs included ~70 files across 3 languages for types nobody consumed
- `commons/` package (7 files) defined metadata, audit, visibility, kind, field options, RPC service options, and pagination — all hosted-service concerns
- buf configs included gRPC and ConnectRPC plugins generating service stubs for RPCs that will never be called

## Solution

Delete everything that isn't the scenario definition itself. Keep the two essential proto files, rename the message to match its new role as the top-level type, simplify the toolchain, and update the SDK adapter to match.

## Implementation Details

### Proto Layer

- **Deleted `commons/` entirely** (7 proto source files): ResourceMetadata, ResourceAudit, ResourceVisibility, ResourceKind, field options, RPC service options, PageInfo
- **Deleted 4 service protos**: `api.proto` (resource envelope with apiVersion/kind/metadata/status), `command.proto` (ScenarioCommandController), `query.proto` (ScenarioQueryController), `io.proto` (ScenarioId, Scenarios, ListScenariosInput, RenderInput/Output)
- **Renamed** `spec.proto` to `scenario.proto` and message `ScenarioSpec` to `Scenario` — this is no longer the "spec" part of a larger resource, it IS the scenario
- **Cleaned buf.yaml**: removed 6 lint exceptions that only applied to service RPCs and unversioned commons packages
- **Removed service plugins**: ConnectRPC from TypeScript gen, gRPC from Go and Python gen
- **Regenerated stubs**: from ~70 files down to 11 clean files (scenario + enum per language, plus validate_pb for TS)

### SDK Layer

- **Deleted `ProtoScenario`** envelope type (the `{apiVersion, kind, spec}` wrapper)
- **Renamed `ProtoScenarioSpec` to `ProtoScenario`** — the spec-level type is now the top-level accepted type
- **Simplified `loadScenarioFromProto`**: removed `apiVersion` validation, `kind` validation, and `spec` null-check; function now accepts the scenario directly
- **Flattened error paths**: `spec.steps[i]` became `steps[i]` since there's no envelope nesting
- **Removed 3 tests** (apiVersion, kind, spec-missing validation); updated remaining 8 tests to work with the flat structure

### Proto File Inventory: Before and After

**Before (13 proto source files, ~70 generated stubs):**
```
apis/ai/scenar/
├── commons/resource/   (6 files)
├── commons/rpc/        (1 file)
└── scenario/v1/        (6 files)
```

**After (2 proto source files, 11 generated stubs):**
```
apis/ai/scenar/scenario/v1/
├── scenario.proto      (Scenario, ViewportConfig, Step, StepAction, configs)
└── enum.proto          (ActionType)
```

## Benefits

- **Proto surface area**: 13 files → 2 files (85% reduction)
- **Generated stubs**: ~70 files → 11 files (84% reduction)
- **Codebase**: -5,159 lines net
- **New user comprehension**: scenario contract is readable in under 2 minutes
- **SDK simplicity**: no envelope validation, no apiVersion/kind ceremony — pass the scenario, get back an AuthoredScenario
- **Toolchain**: no gRPC/ConnectRPC plugins running on builds — faster `make protos`

## Impact

- `@scenar/sdk` public API: `ProtoScenarioSpec` type removed, `ProtoScenario` now refers to the scenario directly (breaking change for 0.0.1 consumers)
- `loadScenarioFromProto` accepts the scenario directly instead of an envelope — simpler call site
- All 76 existing tests pass (core: 27, sdk: 28, react: 21)
- `buf lint` and `buf build` pass clean
- Go, Python, and TypeScript stubs are all regenerated and minimal

## Related Work

- Follows from the product strategy decision that scenarios are files in git, not rows in a database
- Enables the upcoming `@scenar/cli` scaffolding (the CLI operates on the simplified proto shape)
- commons/ and service protos can be re-introduced in Phase 2 if/when a hosted Scenar service is built

---

**Status**: Production Ready
**Timeline**: Single session
