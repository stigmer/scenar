# Sub-Project: 20260417.03.sp.proto-simplify-and-cli

## Parent Project

**Parent**: 20260417.02.scenar-product
**Parent Path**: `_projects/2026-04/20260417.02.scenar-product/`
**Spawned From Task**: Product strategy discussion (proto contract is over-engineered for Phase 1)

## Overview

Simplify the Scenar proto contract from a Kubernetes-style resource model to a flat, user-friendly scenario definition. Remove CRUD/render RPCs that assume a hosted service. Update all downstream code (stubs, SDK adapter, tests). Then scaffold the `@scenar/cli` package with the `narrate` command as the first real CLI feature.

**Created**: 2026-04-17
**Status**: Active 🟢

## Project Information

### Primary Goal

Strip the Scenar proto contract down to what Phase 1 actually needs — the scenario spec and nothing else — then build the CLI that operates on it.

### Timeline

**Target Completion**: 1-2 sessions

### Technology Stack

TypeScript, Protobuf (buf), Node.js CLI

### Project Type

Simplification + New Package

### Affected Components

- `apis/` — proto source files and generated stubs (TS, Go, Python)
- `packages/sdk/` — proto adapter (`proto-types.ts`, `load-scenario.ts`, tests)
- `packages/cli/` — new package (scaffolded in this sub-project)

## Project Structure

- **`tasks/`** - Detailed task planning and execution logs
- **`checkpoints/`** - Major milestone summaries (⚠️ ASK before creating)
- **`design-decisions/`** - Significant architectural choices (⚠️ ASK before creating)
- **`coding-guidelines/`** - Project-wide code standards (⚠️ ASK before creating)
- **`wrong-assumptions/`** - Important misconceptions (⚠️ ASK before creating)
- **`dont-dos/`** - Critical anti-patterns (⚠️ ASK before creating)

## How to Resume Work

**Quick Resume**: Drag and drop `next-task.md` into your AI conversation.
