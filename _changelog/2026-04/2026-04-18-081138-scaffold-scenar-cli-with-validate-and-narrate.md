# Scaffold `scenar` CLI with validate and narrate commands

**Date**: April 18, 2026

## Summary

Scaffolded the `scenar` CLI package — the primary user-facing entry point for the Scenar ecosystem. The CLI validates scenario YAML files against the proto schema and generates narration audio from step-level narration text. Published as `scenar` (unscoped) on npm, following the Prisma/Turbo/Storybook pattern where the product name is the CLI.

## Problem Statement

After T01 simplified the proto contract to a flat `Scenario` message with YAML as the authoring format, there was no tool to validate those YAML files or generate narration audio from them. Users writing scenarios had no feedback loop before runtime, and the narration pipeline (extracting `narration_text` per step, generating audio, producing a manifest) had no automation.

### Pain Points

- No way to validate scenario YAML files before loading them in the browser
- No tooling to generate narration audio from scenario definitions
- The TTS workflow (extract text, call provider, write files, compute durations) was entirely manual
- No CI-friendly validation output (JSON format for machine consumption)

## Solution

Created `packages/cli/` as a new monorepo package with two commands:

- **`scenar validate <file>`** — structural validation against all proto schema constraints
- **`scenar narrate <file>`** — TTS audio generation with pluggable providers

The CLI accepts scenario YAML in proto-native snake_case and converts internally to camelCase, bridging the YAML and TypeScript conventions cleanly.

## Implementation Details

### Package Architecture

- **npm name**: `scenar` (unscoped) — users run `npx scenar validate my-demo.yaml`
- **Monorepo directory**: `packages/cli/`
- **Binary**: `scenar`
- **Framework**: Commander.js for CLI parsing
- **Dependencies**: `commander`, `yaml`, `@scenar/sdk` (workspace)

### YAML Loader (`src/util/load-yaml.ts`)

Reads scenario YAML from disk, parses it, and recursively converts snake_case keys to camelCase. This bridges the proto/YAML convention (snake_case) with the TypeScript runtime convention (camelCase) used by `@scenar/sdk`'s `ProtoScenario` type.

### Scenario Validator (`src/validate/scenario-validator.ts`)

Implements all `buf.validate` constraints from `scenario.proto` as TypeScript validation logic:

- `steps` non-empty array, `view` non-empty string, `delayMs` >= 0
- `atPercent` in [0.0, 1.0], valid `ActionType` enum, target required for cursor actions
- Config-specific rules: `typeConfig.text` non-empty, `dragConfig.dragTarget` non-empty
- Returns structured `{ valid, errors: [{ path, reason }] }` — never throws

The validator lives in the CLI, not in `@scenar/sdk`. The SDK's `loadScenarioFromProto` does semantic validation (view registry resolution) at a different level. Keeping them separate avoids coupling the CLI to React concerns.

### TTS Provider Abstraction (`src/tts/`)

Clean `TtsProvider` interface with two implementations:

- **Echogarden** — free offline TTS, TypeScript-native. Made an **optional peer dependency** because it's GPL v3 (Scenar is Apache-2.0). Dynamic import with graceful error if not installed.
- **OpenAI** — paid TTS via the `/v1/audio/speech` API. Requires `OPENAI_API_KEY` env var.

Provider resolution uses a factory that checks availability and provides clear guidance when a provider isn't configured.

### Narrate Command (`src/commands/narrate.ts`)

- Validates scenario first (reuses the validator)
- Filters steps with non-empty `narrationText`
- Generates one `.mp3` per narrated step via the resolved TTS provider
- Writes `manifest.json` with step indices, file paths, durations, and narration text
- Shows progress during generation: `[2/5] Generating audio for step 3...`
- `runNarrate` accepts an injected `TtsProvider` for testability

### SDK Change

Added `PROTO_ACTION_TYPE` constant and `ProtoActionTypeValue` type to `@scenar/sdk` public exports. These were already defined in `proto-types.ts` but not exported — the CLI validator needs them to check action type validity.

### Test Coverage

48 new tests across 6 test files:

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `load-yaml.test.ts` | 7 | snake_case conversion, edge cases, error handling |
| `scenario-validator.test.ts` | 27 | every proto constraint, multi-error collection |
| `validate-command.test.ts` | 4 | CLI output formatting, exit codes, --json flag |
| `openai-provider.test.ts` | 3 | API call shape, missing key error, error response |
| `resolve-provider.test.ts` | 4 | provider resolution, availability checks |
| `narrate-command.test.ts` | 3 | file generation, manifest structure, edge cases |

Total workspace: 124 tests across 4 packages (27 core + 28 sdk + 21 react + 48 cli).

## Benefits

- **Immediate validation feedback**: Authors catch schema errors before runtime
- **CI integration**: `--json` output enables automated quality gates
- **Narration automation**: One command generates all audio files + timing manifest
- **Pluggable TTS**: Free offline default with paid upgrade path
- **License-clean**: Echogarden GPL v3 isolated as optional peer dependency

## Impact

- **Scenario authors**: Can validate YAML files during development
- **CI pipelines**: Can gate merges on scenario validity
- **Content creators**: Can generate narration audio without manual TTS workflows
- **Ecosystem**: `scenar` npm name established as the CLI entry point

## Related Work

- T01: Proto simplification (prerequisite — `21acbeb`)
- `@scenar/sdk`: Proto types and action constants now exported for CLI consumption
- Future: Additional CLI commands as the product evolves

---

**Status**: Production Ready
**Timeline**: Single session (T02)
