# Scenar Authoring Reference

Deep reference for the [scenar skill](SKILL.md): the shell catalog, page parts,
the `createScenario` SDK (Path B), provider + router-transport wiring (Path A),
the proto/YAML shape, and bundle constraints.

## Canonical example

The bundled example is the best reference — read it before authoring:

- `packages/cli/examples/welcome-tour/steps.ts` — a four-step `ScenarioStep<T>[]`
- `packages/cli/examples/welcome-tour/index.tsx` — `renderStep` switching on
  `data.screen`, wrapping `@scenar/react` page templates in a `BrowserView`

## Shell catalog (`@scenar/react`)

Every shell takes `contentKey: string` (pass `String(stepIndex)`) and an
optional `slideDirection?: "forward" | "backward"`.

| Shell | Frames | Key props |
|-------|--------|-----------|
| `BrowserView` | a web app | `url`, `children`, `zoom?` |
| `TerminalView` | a CLI session | `lines: TerminalLine[]`, `cwd?`, `title?`, `fontSize?` |
| `CodeEditorView` | an IDE | `files: FileTreeEntry[]`, plus active file/content |
| `MobileView` | a phone app | mobile chrome + `children` |
| `ChatView` | a messaging UI | messages; pair with `ChatBubble`, `TypingIndicator` |
| `SlideView` | a presentation slide | slide content |
| `DashboardView` | an app with sidebar | `sidebarItems: SidebarItem[]`, `children` |
| `APIClientView` | a Postman-style client | `method: HttpMethod`, request/response |
| `DesktopView` | a desktop window | window chrome + `children` |

`TerminalLine` is `{ type: "prompt" | "output" | "error" | "success" | "blank"; text: string }`.

## Page primitives & templates

Use inside a `BrowserView`/`DashboardView` to draw realistic app screens
(all CSS-drawn; lucide icons inline as components):

- **Templates**: `LoginCardPage`, `DashboardPage`, `SettingsFormPage`, `AdminListPage`
- **Primitives**: `PageLayout`, `AppBar` (`navLinks: NavLink[]`), `SideNav`
  (`items: SideNavItem[]`), `FormCard` (`fields: FormField[]`), `DataTable`
  (`columns`, `rows`), `SettingsForm`, `Breadcrumb`, `StatusBadge`
  (`variant: "success" | "info" | "warning" | ...`), `PulseHighlight` (draws
  attention to a region).

`DashboardPage` props (as used by welcome-tour): `appName`, `userName`,
`navLinks: NavLink[]`, `sidebarItems: SideNavItem[]`, `children`. A `NavLink` is
`{ label: string; active?: boolean }`; a `SideNavItem` adds `isSection?: boolean`.

## Interactions — full `StepAction` shape

```ts
interface StepAction {
  atPercent: number;          // 0.0–1.0 of the step's narration duration
  type: ActionType;
  target?: string;            // matches data-cursor-target / data-scroll-target
  dragTarget?: string;        // drag destination (data-cursor-target)
  text?: string;              // for "type"
  typeDelay?: number;         // ms/char (default 50)
  hoverDuration?: number;     // ms held during "hover" (default 1500)
  viewportZoom?: number;      // for "viewport_transition" (>1 zooms in; default 1.5)
  viewportReset?: boolean;    // reset viewport to identity (ignores target/zoom)
}
```

`ActionType`: `set_cursor`, `clear_cursor`, `click`, `type`, `hover`, `drag`,
`scroll_to`, `viewport_transition`.

Targeting attributes (set them in `renderStep` output):
- `data-cursor-target="id"` — cursor actions (`set_cursor`/`click`/`type`/`hover`/`drag`)
- `data-scroll-target="id"` — `scroll_to`
- The engine sets `data-hover` during a hover and `data-dragging` during a drag;
  style against them for feedback.

Timing rule: with narration, `atPercent` maps onto the clip's real duration; when
muted, it maps onto the next step's `delayMs`. So author narration first for
tight sync, or set deliberate `delayMs` values for muted tours.

## Path B — the `createScenario` SDK (type-safe)

For code-authored scenarios, `createScenario` gives compile-time prop checking:
each step's `props` is typed against the component registered under its `view`.

```ts
import { createScenario } from "@scenar/sdk";
import { LoginScreen, Dashboard } from "./screens";

export default createScenario({
  viewport: { width: 896, height: 480 },
  views: { login: LoginScreen, dashboard: Dashboard },
  steps: [
    { view: "login", delayMs: 0,
      narrationText: "Sign in to your workspace.",
      props: { email: "jordan@acme.cloud" } },          // typed to LoginScreen's props
    { view: "dashboard", delayMs: 2400,
      props: { userName: "Jordan" } },
  ],
});
```

`StepInput` uses `narrationText` (not `narration`) and carries `props` instead of
a free-form `data`. The output plugs straight into `<ScenarioPlayer>`.

## Path A — real components: provider + router-transport wiring

`scenar install <your-component-package>` adds the package as a dependency and
scaffolds a runnable starter tour. There is **no registry and no scan**: your
`index.tsx` imports the real components directly, exactly like any React app.

The one piece to wire by hand is each tour's `.scenar/providers.tsx`, which
exports `PreviewProviders`. `scenar pack` (embed) and `scenar render` (video)
both wrap every step of the tour in it, so this is where the components get the
provider and the data they need to render with no live backend.

For **Connect-RPC SDKs** (e.g. `@stigmer/react`), mock the RPCs your components
call with an in-process router transport — no network, no service worker — and
resolve the embed's light/dark mode with `getEmbedColorMode()` from
`@scenar/react`:

```tsx
import type { ReactNode } from "react";
import "@your-org/ui/styles.css";              // pack bundles JS, not Tailwind
import { createRouterTransport } from "@connectrpc/connect";
import { getEmbedColorMode } from "@scenar/react";
import { YourClient } from "@your-org/sdk";
import { YourProvider } from "@your-org/ui";
import { ProjectController } from "@your-org/protos/project/v1/query_pb";

const transport = createRouterTransport((router) => {
  router.service(ProjectController, {
    list: () => ({ projects: [{ id: "1", name: "checkout-api" }] }),
  });
});
const client = new YourClient({ baseUrl: "/", customTransport: transport });

export function PreviewProviders({ children }: { readonly children: ReactNode }) {
  return (
    <YourProvider client={client} colorMode={getEmbedColorMode()}>
      {children}
    </YourProvider>
  );
}
```

If the SDK isn't Connect-RPC based, use whatever in-process mock the client
accepts — the only contract is that `PreviewProviders` renders the components
without a backend. The product glue (client + provider + stylesheet) repeats
across tours, so factor it into one local helper and let each tour's
`providers.tsx` pass only its fixtures. This wiring is the one step that can't be
automated — do it explicitly with the user. Re-running `scenar install` never
overwrites it.

## YAML / proto scenarios

`scenar validate` checks a scenario **YAML** against the proto schema
(`ai.scenar.scenario.v1`). `ActionType` values match the proto enum names
verbatim, so YAML interactions use the same `scroll_to`/`set_cursor`/... strings.
Most authoring is TS-first (directory form); YAML is for proto-driven pipelines.

## Bundle constraints (`scenar pack`)

The packed bundle must satisfy the deploy allowlist (enforced at pack time):

- Allowed file types: `html`, `js`, `css`, `json`, `mp3`, raster images
  (`png`/`jpg`/`jpeg`/`gif`/`webp`/`avif`), `woff2`/`woff`.
- **No SVG files** — SVG is active content. Inline SVG as a React component or a
  `data:` URI instead. (lucide-react icons are already inline components.)
- Prefer CSS-drawn UI. Import raster assets with a normal `import logo from
  "./logo.png"` — Vite emits a hashed file at pack time.
- Relative asset URLs only (the bundle is served from an origin/subpath root):
  pack sets Vite `base: "./"` for you.
- `scenar pack` writes `scenario.json` (records the canonical viewport for the
  embed aspect ratio) and `pack-manifest.json` (every file + sha256 + content
  type). Don't hand-edit these.

## Sizing: one scale factor per frame

A scenario should read like a screen recording: a real app laid out at real
size, scaled once at the viewport boundary. Author content at real
application metrics and let `DemoViewport` (browser) or the export
composition own the single scale factor.

- Pick the canonical viewport with `--width` / `--shell-height` at pack time
  (e.g. `--width 1280 --shell-height 800` for a 16:10 desktop app window).
  The defaults (896x480) suit single-card content, not full app depictions.
- **Never author per-element `zoom` or `transform: scale()` inside views** to
  "make things fit" — composed scale factors are what make a scenario read
  as a shrunken mockup instead of a recording. If content doesn't fit, the
  canonical viewport is wrong or the content shows too much.
- `viewport_transition` (the camera) is how small text stays legible at
  desktop metrics: zoom into the region the narration discusses, reset
  before the beat ends. The camera is a deterministic 600ms ease-out tween,
  identical in browser playback and video export.
- `--stage` floats the scenario on a backdrop with a window shadow
  (screen-recording framing). Pair it with a window shell (`BrowserView` for
  web apps) so the depicted app lives in a believable container.

## Hosting the embed

- `scenar serve <bundle>` → `http://localhost:4173/` (ephemeral local preview).
- `scenar publish <bundle>` → `https://<owner>.github.io/scenar-embeds/<slug>/`
  (GitHub Pages; needs the `gh` CLI authenticated). Public and permanent. Many
  tours share one repo (`--repo`, default `scenar-embeds`), each under its slug
  (`--path`, default the scenario slug; `--path /` for the repo root); publishing
  one tour preserves its siblings.
- Both print a responsive `<iframe>` snippet pinned to the bundle's aspect ratio.
- `scenar render <dir>` → an MP4 (same source, via Remotion).
