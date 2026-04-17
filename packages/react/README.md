# @scenar/react

React components and hooks for the Scenar scenario playback engine. Build interactive web embeds and pixel-perfect video from the same scenario source.

## Install

```bash
pnpm add @scenar/react @scenar/core
```

### Peer dependencies

- `react` >= 18
- `react-dom` >= 18
- `framer-motion` >= 11
- `lucide-react` >= 0.400 (optional — only needed if you use the built-in control icons)

## Components

### `<ScenarioPlayer>`

Video-style playback engine. Renders a poster overlay, progress bar with chapter markers, transport controls, and narration audio.

```tsx
import { ScenarioPlayer } from "@scenar/react";

<ScenarioPlayer steps={steps} narrationManifest={manifest}>
  {(data, stepIndex) => <YourContent data={data} />}
</ScenarioPlayer>
```

### `<DemoViewport>`

Fixed virtual viewport that CSS-zooms children from a canonical width to fit the container. Decoupled from any site-specific tokens — pass your own `canonicalWidth`, `minZoom`, `shellHeight`, and `wrapperClassName`.

### `<Cursor>`

Animated pointer overlay that spring-animates to `data-cursor-target` elements with a click ripple.

### `<ViewportTransformLayer>`

Framer Motion container for smooth zoom/pan transitions.

## Hooks

### `useStepInteractions(options)`

Schedule timed mid-step interactions (scroll, cursor, click, type, hover, drag, viewport_transition). Reads interactions from each step's inline `interactions` field. Automatically uses `setTimeout` in browser mode or frame-driven firing in video-export mode.

### `useNarrationManifest(scenarioId, resolveUrl?)`

Fetch a narration manifest JSON. The URL convention is configurable via the second argument.

### `useNarrationPlayback(options)`

Manage audio playback synced to step progression, including mute toggle and playback rate.

### `useTimeSource()` / `<TimeSourceProvider>`

Frame-based time source for deterministic video rendering (e.g. Remotion).

### `useVideoExport()` / `<VideoExportProvider>`

Video export settings context (hides controls, sets unmuted timing).

## Re-exports from @scenar/core

For convenience, `@scenar/react` re-exports all types and constants from `@scenar/core`, so consumers can import everything from a single package.

## License

Apache-2.0
