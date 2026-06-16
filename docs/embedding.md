# Embedding a tour

Once a tour is hosted (`scenar serve` or `scenar publish` — see
[Hosting](hosting.md)), you embed it on any page with an iframe pointed at its
URL. There are two ways to do it, and `serve`/`publish` print both.

## 1. The no-JS snippet (default)

A plain, responsive `<iframe>` in a box that pins the tour's recorded aspect
ratio. It works everywhere, needs no script, and is the safest default:

```html
<div style="position:relative;width:100%;max-width:896px;aspect-ratio:896/480">
  <iframe
    src="https://you.github.io/scenar-embeds/welcome-tour/"
    title="Welcome tour"
    loading="lazy"
    style="position:absolute;inset:0;width:100%;height:100%;border:0"
    allow="autoplay; fullscreen"
    allowfullscreen
  ></iframe>
</div>
```

That's all most pages need. Use the enhanced loader below when you want the
embed to **auto-fit its exact size** and **follow your page's light/dark theme**.

## 2. The `<scenar-embed>` loader (auto-fit + theme sync)

The [`@scenar/embed`](../packages/embed) package provides a `<scenar-embed>`
custom element and a matching React component. Both:

- adopt the embed's exact aspect ratio from the tour itself (no hard-coded box),
- sync the embed to your page's theme (the `dark` class on `<html>`) and re-theme
  it live when the user toggles,
- pin the embed's origin and validate every message, with no glue code on your side.

`scenar pack` copies the loader into every bundle as `embed.js` (a sibling of
`index.html`), so the snippet below works on GitHub Pages, a local `serve`, or
any static host.

### Plain HTML (`<script>` paste)

```html
<script type="module" src="https://you.github.io/scenar-embeds/welcome-tour/embed.js"></script>

<scenar-embed
  src="https://you.github.io/scenar-embeds/welcome-tour/"
  title="Welcome tour"
></scenar-embed>
```

You can also load the element from a CDN instead of the bundle copy:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@scenar/embed/dist/embed.global.js"></script>
```

### With a bundler

```ts
import "@scenar/embed/define"; // registers <scenar-embed>
```

```html
<scenar-embed src="https://you.github.io/scenar-embeds/welcome-tour/" title="Welcome tour"></scenar-embed>
```

### React

```tsx
import { ScenarEmbed } from "@scenar/embed/react";

export function Demo() {
  return (
    <ScenarEmbed
      src="https://you.github.io/scenar-embeds/welcome-tour/"
      title="Welcome tour"
    />
  );
}
```

`react` and `react-dom` are optional peer dependencies — only the `/react`
subpath needs them. The component is SSR-safe: it renders no `src` on the server,
so hydration never mismatches.

You can also reference a tour by slug instead of a full URL:

```tsx
<ScenarEmbed id="welcome-tour" base="https://you.github.io/scenar-embeds" title="Welcome tour" />
```

## Theme

The loader's `theme` is `auto` (default), `light`, or `dark`:

- `auto` — track the host page's `dark` class on `<html>` and re-theme on toggle.
- `light` / `dark` — pin the theme regardless of the host.

```html
<scenar-embed src="…" theme="dark"></scenar-embed>
```

```tsx
<ScenarEmbed src="…" theme="dark" />
```

## Controlling playback

Both adapters expose the embed's transport (`play`, `pause`, `seek`, `setMuted`,
`setVolume`) and surface its events. In the DOM, events arrive as
`scenar:<type>` custom events; in React, via `onEvent` and a ref handle:

```tsx
import { useRef } from "react";
import { ScenarEmbed, type ScenarEmbedHandle } from "@scenar/embed/react";

function Demo() {
  const ref = useRef<ScenarEmbedHandle>(null);
  return (
    <>
      <button onClick={() => ref.current?.play()}>Play</button>
      <ScenarEmbed ref={ref} src="…" onEvent={(e) => console.log(e.type)} />
    </>
  );
}
```

For a fully custom host, the framework-free `createEmbedMount(iframe, options)`
gives you the same bridge over an iframe you own.
