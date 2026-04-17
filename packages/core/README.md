# @scenar/core

Pure TypeScript types, timing constants, and utility functions for the Scenar scenario playback engine. Zero framework dependencies — no React, no DOM (except scroll utilities).

## Install

```bash
pnpm add @scenar/core
```

## What's inside

### Scenario types

- **`ScenarioStep<T>`** — A single step in a scenario timeline with typed data payload, delay, caption, narration text, and inline interactions.
- **`StepAction`** — A timed interaction within a step (click, type, hover, drag, scroll_to, set_cursor, clear_cursor, viewport_transition).

### Timeline computation

- **`computeStepTimeline(steps, manifest)`** — Pre-compute step start times and total duration from step delays and narration clip durations.
- **`deriveStepFromTime(currentTimeMs, stepStartTimesMs, maxIndex)`** — Find the active step for a given playback time (used by the video-export path).
- **`getStepDurationMs(stepIndex, manifest, steps)`** — Effective duration of a step for interaction timing.

### Timing constants

- `CLICK_DELAY_MS` (450) — Cursor settle time before click ripple.
- `TYPE_CHAR_DELAY_MS` (50) — Default per-character typing delay.
- `HOVER_HOLD_MS` (1500) — Default hover dwell time.
- `DRAG_SETTLE_MS` (200) — Pause at drag source before movement.
- `VIEWPORT_SETTLE_MS` (500) — Viewport transition spring settle time.

### DOM utilities

- `findScrollParent(el)` — Walk up the DOM to find the nearest scrollable ancestor.
- `scrollTargetIntoView(el)` — Smooth-scroll an element into its scroll container.
- `scrollTargetIntoViewInstant(el)` — Instant-scroll variant for video export.

### Cursor position

- `computeCursorPosition(container, el)` — Compute cursor position accounting for CSS zoom.

### Data-attribute contract

The engine identifies interactive elements via data attributes. These constants are the single source of truth:

- `CURSOR_TARGET_ATTRIBUTE` — `"data-cursor-target"`
- `SCROLL_TARGET_ATTRIBUTE` — `"data-scroll-target"`
- `HOVER_STATE_ATTRIBUTE` — `"data-hover"`
- `DRAG_STATE_ATTRIBUTE` — `"data-dragging"`
- `cursorTargetSelector(id)` — Build a CSS selector for a cursor target.
- `scrollTargetSelector(id)` — Build a CSS selector for a scroll target.

### Viewport transform

- `ViewportTransform` — `{ scale, x, y }` for zoom/pan state.
- `VIEWPORT_TRANSFORM_IDENTITY` — The no-op transform.

### Narration types

- `NarrationEntry` — `{ src, durationMs }` for one audio clip.
- `NarrationManifest` — `{ steps: (NarrationEntry | null)[] }`.

## License

Apache-2.0
