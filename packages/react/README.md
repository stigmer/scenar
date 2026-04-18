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

## Styling

The package ships two CSS files. Choose the one that matches your setup.

### Option A: Self-contained (no Tailwind required)

Import `styles.css` — a pre-built bundle containing every utility class used by Scenar components plus the `--scenar-*` design tokens. Wrap your scenario container with the `scenar` class (add `dark` for dark mode):

```tsx
import "@scenar/react/styles.css";
import { ScenarioPlayer, SCENAR_CLASS } from "@scenar/react";

function Demo() {
  return (
    <div className={`${SCENAR_CLASS} dark`}>
      <ScenarioPlayer steps={steps}>{(data) => <View data={data} />}</ScenarioPlayer>
    </div>
  );
}
```

### Option B: Tailwind host (bring your own theme)

Import `theme.css` for the `--scenar-*` token definitions only. Add a `@source` directive so your Tailwind build scans the package for utility classes:

```css
/* globals.css */
@import "tailwindcss";
@import "@scenar/react/theme.css";

@source "../node_modules/@scenar/react/**/*.js";
```

Your host's Tailwind theme tokens (`--color-foreground`, `--color-border`, etc.) will drive player control appearance, keeping it consistent with your site.

### Design tokens

All tokens are scoped under the `.scenar` class via `@layer scenar`:

| Token | Purpose |
|-------|---------|
| `--scenar-surface` | Shell content area background |
| `--scenar-border` | Shell border color |
| `--scenar-foreground` | Primary text / icon color |
| `--scenar-muted-foreground` | Secondary text color |
| `--scenar-card` | Popover / dropdown background |
| `--scenar-accent` | Hover state background |
| `--scenar-primary` | Active / selected indicator |
| `--scenar-ring` | Focus ring color |

Override any token in your own CSS to customize the palette.

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
