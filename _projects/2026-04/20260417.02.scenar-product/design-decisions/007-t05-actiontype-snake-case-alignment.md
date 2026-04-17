# DD-007: ActionType Snake-Case Alignment

**Date**: 2026-04-17
**Task**: T05
**Status**: Applied

## Context

Proto `ActionType` enum values use snake_case: `set_cursor`, `clear_cursor`, `scroll_to`, `viewport_transition`.

Engine `ActionType` union used kebab-case: `"set-cursor"`, `"clear-cursor"`, `"scroll-to"`, `"viewport-transition"`.

The SDK's action mapper would need a bidirectional string-name mapping table.

## Decision

Align engine ActionType string literals with proto enum names:

```ts
type ActionType =
  | "set_cursor" | "clear_cursor" | "click" | "type"
  | "hover" | "drag" | "scroll_to" | "viewport_transition";
```

## Rationale

- One source of truth: proto enum names are the canonical vocabulary.
- Eliminates all mapping code in the SDK action mapper (direct name copy).
- snake_case is the standard naming convention in proto; the engine should not invent its own variant.
- `click`, `type`, `hover`, `drag` are single-word and unchanged.

## Impact

- All action-type matchers in hooks, effects, and warnings updated.
- Existing Stigmer demos (T06) will need string literal updates.
