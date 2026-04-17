# DD-008: SDK Framework Agnosticism

**Date**: 2026-04-17
**Task**: T05
**Status**: Applied

## Context

`@scenar/core` is framework-agnostic (zero deps). `@scenar/react` depends on React + Framer Motion. The SDK sits between them — it produces the data structures that the player consumes.

## Decision

`@scenar/sdk` has zero React dependency. The `ViewRegistry` type constraint is "anything that accepts props" — not `React.ComponentType`:

```ts
type ViewRegistry = Record<string, (props: never) => unknown>;
```

The SDK does not import React. The player's render prop is what actually calls the component. Framework-specific wiring (e.g., a `<Scenar>` wrapper) belongs in `@scenar/react`, not in the SDK.

## Rationale

- Matches `@scenar/core`'s zero-deps stance — SDK is a pure-TS package.
- Enables non-React consumers (e.g., Vue, Solid, server-side validation) to use the same authoring surface.
- Avoids pulling React into the dependency tree for CLI tools or build scripts that only validate scenarios.

## Verification

`rg 'react|framer-motion' packages/sdk/` returns zero matches.
