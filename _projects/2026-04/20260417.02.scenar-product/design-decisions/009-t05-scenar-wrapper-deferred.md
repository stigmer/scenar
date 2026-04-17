# DD-009: Scenar Wrapper Component Deferred to Post-T06

**Date**: 2026-04-17
**Task**: T05
**Status**: Applied

## Context

Existing Stigmer demos wire `<ScenarioPlayer>`, `<Cursor>`, `<DemoViewport>`, `useStepInteractions`, and `<ViewportTransformLayer>` by hand — approximately 200 LOC of boilerplate per demo. A `<Scenar>` wrapper component could reduce this to ~20 LOC.

## Decision

Do NOT build the wrapper in T05. Defer to a dedicated task after T06 has rewired at least one real Stigmer demo.

## Rationale

- The wrapper should encapsulate observed patterns, not predicted ones. Building it blind risks over-abstraction (too many props) or under-power (missing an important configuration path).
- T06 will reveal which wiring is truly boilerplate vs. scenario-specific. The wrapper's prop surface should emerge from that evidence.
- Premature wrapper design increases T06's rewrite cost: if the wrapper API is wrong, every rewired demo needs re-rewiring.
- The SDK's job is to produce the data structures. The wrapper's job is to compose the React components. These are separate concerns with separate iteration cycles.

## Follow-up

After T06 completes, propose a `<Scenar scenario={...} narrationManifest={...}>` component in `@scenar/react` that internalizes the common wiring pattern.
