# Getting started

This is the end-to-end walkthrough: from a React app to a published, narrated
embed. It uses the AI-assisted flow (Cursor + the Scenar MCP server + the Scenar
skill), and is honest about the one step that needs a human — wiring a provider
and mock data so your real components render in isolation.

If you just want to see the pipeline run with zero setup, jump to
[Try it with the example](#try-it-with-the-example).

## Prerequisites

- Node.js 20+ and a package manager (npm / pnpm).
- A React app (Vite, Next.js, CRA, etc.) — for the "real components" path.
- [Cursor](https://cursor.com) or another MCP-capable editor.
- [GitHub CLI](https://cli.github.com) (`gh`), authenticated, if you'll `publish`.

## 1. Install the MCP server and skill

Add the MCP server to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "scenar": { "command": "npx", "args": ["-y", "@scenar/mcp-server"] }
  }
}
```

Add the skill so the AI knows the authoring model:

```bash
mkdir -p .cursor/skills
cp -R node_modules/@scenar/mcp-server/skill .cursor/skills/scenar
```

Restart the editor so it picks up the MCP server and skill. See
[mcp-server.md](mcp-server.md) for other editors and configuration.

## 2. Create your demos project

**Where to run it.** Use a dedicated demos repo (e.g. `your-app-demos`) so the
packed bundles stay out of your product repo. You can also keep it in a `demos/`
folder inside your app repo, or as a workspace member in a monorepo — the only
difference is where these files land.

In an empty directory, run `scenar install` with the component package(s) you
want to demo:

```bash
npx @scenar/cli install @your-org/ui
```

Or ask the AI: *"Run scenar install with @your-org/ui."* (it calls
`scenar_install`). This one command:

- scaffolds a `package.json`, a `tsconfig.json`, a `.gitignore`, and a runnable
  **starter tour** under `tours/example-tour/` if the directory is empty,
- adds `@your-org/ui` (plus `@scenar/react` and React) as dependencies and runs
  your package manager.

Specs are resolver-agnostic — a registry version (`@your-org/ui@1.2.0`),
`workspace:*`, `file:../ui`, or a git URL all work. Inside a monorepo the
project is detected as a workspace member and the install runs at the root.

The starter tour is everything you author and own:

| File | Purpose |
|------|---------|
| `tours/example-tour/steps.ts` | the timeline: data, delayMs, captions, narration |
| `tours/example-tour/index.tsx` | `renderStep(data, i)` — composes your components |
| `tours/example-tour/.scenar/providers.tsx` | wraps the tour with providers + mock data |

It's built from `@scenar/react` shells so `scenar pack tours/example-tour` works
immediately. There is **no generated registry and nothing to re-scan**: you
import your real components directly in `index.tsx`. Re-running `scenar install`
only adds more dependencies — it never overwrites your authored files, so it's
always safe to run again.

**What to commit.** Version-control everything under `tours/`. Ignore
regenerable output (the scaffolded `.gitignore` already does this):

```gitignore
node_modules/
*-bundle/   # packed embeds (rebuild with `scenar pack`)
```

## 3. Wire providers and mock data (the manual step)

Real components rarely render in a vacuum — they need a theme/provider, and their
data fetches need to resolve with no backend. This is the one part worth a human,
and it lives in each tour's `.scenar/providers.tsx`. `scenar pack` and
`scenar render` both wrap every step of the tour in your exported
`PreviewProviders`.

The recommended pattern for **Connect-RPC SDKs** (e.g. `@stigmer/react`) is an
in-process **router transport**: mock the RPCs your components call directly — no
network, no service worker. Match the embed's light/dark mode with
`getEmbedColorMode()` from `@scenar/react`:

```tsx
import type { ReactNode } from "react";
import "@your-org/ui/styles.css";
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

If your SDK isn't Connect-RPC based, use whatever in-process mock your client
accepts — the only contract Scenar cares about is that `PreviewProviders` renders
your components without a live backend. Keep fixtures small and representative:
they become the data your tour shows.

> The product-specific glue (client + provider + stylesheet) is the same across
> every tour, so factor it into one local helper and let each tour's
> `providers.tsx` supply just its fixtures.

## 4. Author the scenario (AI-assisted)

Ask the AI in plain English:

> "Build a Scenar tour of our onboarding: the sign-up screen, creating a
> workspace, then the dashboard. Four steps, with a cursor click on the
> 'Create workspace' button."

Guided by the skill, the AI writes a **scenario directory**:

```
onboarding-tour/
├── steps.ts    # timeline: data, delayMs, captions, narration, interactions
└── index.tsx   # renderStep(data, stepIndex) → ReactNode (your real components)
```

Review it: check the component props, the captions read as a story, and the
interactions (`data-cursor-target` hooks) point at the right elements. See
[authoring-scenarios.md](authoring-scenarios.md) for the full model.

## 5. Narrate

```bash
npx @scenar/cli narrate ./onboarding-tour
```

This synthesizes per-step audio from each step's narration text into a
`narration/` folder. The default TTS engine (echogarden) is an optional install;
`edge-tts` and `openai` are alternatives — see the command's `--help`.

## 6. Pack and preview

```bash
npx @scenar/cli pack ./onboarding-tour
npx @scenar/cli serve ./onboarding-tour-bundle   # → http://localhost:4173/
```

Open the URL and watch it play. Iterate: adjust `delayMs` dwell times, tighten
captions, refine narration, re-run `narrate`/`pack`/`serve`.

## 7. Publish

```bash
npx @scenar/cli publish ./onboarding-tour-bundle
# → https://<you>.github.io/scenar-embeds/onboarding-tour/  + a responsive <iframe> snippet
```

The first publish creates one dedicated public repo named `scenar-embeds` under
your GitHub account — a **separate repo from your application's source** — and
serves each tour from its own path, so publishing more tours never clobbers
earlier ones and nothing lands in your app's repo. Paste the snippet into any
page. Re-publishing a tour updates just its subfolder. See
[hosting.md](hosting.md) for `--repo`/`--path` and custom domains.

## Try it with the example

No app needed — serve the bundled `welcome-tour` (Path B, illustrative
components) straight from npm:

```bash
npx @scenar/cli try   # → http://localhost:4173/
```

That's the same demo as the
[live example](https://stigmer.github.io/scenar-welcome-tour/).

## Troubleshooting

- **A component renders blank or throws.** It's missing a provider or a mock —
  add the provider, or register the RPC it calls, in the tour's
  `.scenar/providers.tsx`.
- **`pack` fails on an SVG.** SVG isn't a served file type. Inline it as a React
  component or a `data:` URI. See [authoring-scenarios.md](authoring-scenarios.md#bundle-constraints).
- **`publish` says gh isn't authenticated.** Run `gh auth login`.
- **Interactions fire at the wrong time.** `atPercent` is measured against the
  step's narration duration; narrate first, or set explicit `delayMs` for muted
  tours.
