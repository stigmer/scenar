# @scenar/embed

Drop-in host-side embedding for hosted [Scenar](https://github.com/stigmer/scenar)
tours. Frame a published tour as a responsive, theme-synced iframe without
hand-writing the `postMessage` listener, the theme sync, or the resize-to-fit
glue.

It builds on the framework-free embed host controller in `@scenar/core`, so the
wire protocol is single-sourced and never drifts. It does **not** pull in the
player runtime (`@scenar/react`) — embedding a hosted tour costs your host page
nothing but this small package.

## Three ways to use it

### 1. Web component (any framework, or none)

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@scenar/embed/dist/embed.global.js"></script>

<scenar-embed
  src="https://you.github.io/scenar-embeds/welcome-tour/"
  title="Welcome tour"
></scenar-embed>
```

Or, with a bundler:

```ts
import "@scenar/embed/define"; // registers <scenar-embed>
```

### 2. React

```tsx
import { ScenarEmbed } from "@scenar/embed/react";

<ScenarEmbed
  src="https://you.github.io/scenar-embeds/welcome-tour/"
  title="Welcome tour"
/>;
```

`react` and `react-dom` are optional peer dependencies — only needed for this
subpath.

### 3. Imperative (build your own host)

```ts
import { createEmbedMount } from "@scenar/embed";

const mount = createEmbedMount(iframeElement, {
  src: "https://you.github.io/scenar-embeds/welcome-tour/",
  theme: "auto",
  onAspectRatio: ({ widthPx, heightPx }) => {
    /* size your container */
  },
});
// mount.controller.play(); mount.controller.pause(); …
// mount.destroy();
```

## Theme

`theme` is `auto` (default), `light`, or `dark`. `auto` tracks the host page's
`dark` class on `<html>` and re-themes the embed when it toggles.

## Corners

The embed paints edge-to-edge; the host boundary owns the corner radius. Round
the React component's wrapper (via `className` or `style`) or the
`<scenar-embed>` element itself (via CSS `border-radius`) — the boundary
carries `overflow: hidden`, so everything inside clips to your radius:

```tsx
<ScenarEmbed src="…" style={{ borderRadius: 12 }} />
```

```css
scenar-embed { border-radius: 12px; }
```

Do not style the internal iframe. Under iframe-as-screen scaling it is laid
out at the tour's canonical viewport and transform-scaled to fit, so a radius
on the iframe would shrink with the scale factor instead of matching your
layout.

## License

Apache-2.0
