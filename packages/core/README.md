# @scenar/core

Pure TypeScript types, timing constants, and utility functions for the Scenar scenario playback engine. Zero framework dependencies — no React, no DOM (except scroll utilities).

## Install

```bash
pnpm add @scenar/core
```

## What's inside

### Scenario types

- **`ScenarioStep<T>`** — A single step in a scenario timeline with typed data payload, delay, narration text, and inline interactions.
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

### Embed protocol (v1)

The wire contract for a packed scenario delivered as a cross-origin iframe. The embedded player emits events; the host page sends commands. Every message carries a fixed source tag and version, and receivers ignore anything that does not match — the global `message` channel is shared with the host and every other widget on the page.

- `SCENAR_EMBED_SOURCE` — `"scenar-embed"`, stamped on every message.
- `SCENAR_EMBED_PROTOCOL_VERSION` — `1`. Bumped only on a breaking message-shape change.
- `ScenarEmbedEvent` — events the player emits (`ready`, `resize`, `started`, `paused`, `stepchange`, `progress`, `completed`, `audioBlocked`, `error`).
- `ScenarEmbedCommand` — commands the host sends (`play`, `pause`, `seek`, `setMuted`, `setVolume`, `prefetch`, `destroy`).
- `frameEmbedEvent(event)` / `frameEmbedCommand(command)` — stamp a message with the source + version envelope, ready to post.
- `parseEmbedEvent(data)` / `parseEmbedCommand(data)` — the schema boundary: validate an inbound `MessageEvent.data` and return the typed message, or `null`. Origin and source-window checks live in the receiver.
- `ScenarEmbedEventMessage` / `ScenarEmbedCommandMessage` — a framed message (event/command plus the envelope) as it travels over `postMessage`.

### Embed host controller

- `createEmbedHostController(target, options?)` — a framework-free driver for an embedded player. It sends commands to the iframe and forwards validated events to `options.onEvent`. Both directions are pinned to `target.origin` (derive it with `new URL(embedUrl).origin`). The same controller backs both the React console preview and a vanilla `embed.js` loader, so host behavior never forks.
- `ScenarEmbedHostController` — the returned handle: `play`, `pause`, `seek`, `setMuted`, `setVolume`, `prefetch`, `destroy`. `destroy()` tells the embed to stop and detaches the message listener; the host still owns the iframe element.
- `ScenarEmbedHostTarget` — `{ iframe, origin }`, the embed this controller drives.
- `ScenarEmbedHostOptions` — `{ onEvent? }`, invoked for every well-formed event from the pinned embed.

## License

Apache-2.0
