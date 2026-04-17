# DD-006: Engine Interactions Inline Migration

**Date**: 2026-04-17
**Task**: T05
**Status**: Applied

## Context

The proto contract (T01, design decision #3) embeds interactions directly on each `Step`:
```proto
message Step {
  repeated StepAction interactions = 6;
}
```

The engine (T03) used a separate index-keyed map:
```ts
type StepInteractions = Readonly<Record<number, readonly StepAction[]>>;
```

This mismatch meant (a) the SDK would need a lossy conversion layer, and (b) re-ordering steps in the map silently misaligns interactions with wrong steps.

## Decision

Migrate the engine to inline interactions on `ScenarioStep<T>`:

```ts
interface ScenarioStep<T> {
  readonly interactions?: readonly StepAction[];
  // ... other fields
}
```

Remove the `StepInteractions` type entirely. Both interaction hooks read from `steps[stepIndex]?.interactions`.

## Rationale

- Proto is the contract of record. Engine must reflect it.
- Index-keyed maps are fragile — silent misalignment on step reorder.
- Eliminates a planned mapping layer in the SDK (less code, fewer bugs).
- The migration is bounded (~10 files, no test logic changes).

## Impact

- `StepInteractions` type removed from `@scenar/core` and `@scenar/react` public APIs.
- Existing Stigmer demos (T06) will need to move their interactions maps inline on steps.
