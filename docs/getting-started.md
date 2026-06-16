# Getting started

This is the end-to-end walkthrough: from a React app to a published, narrated
embed. It uses the AI-assisted flow (Cursor + the Scenar MCP server + the Scenar
skill), and is honest about the one step that needs a human — wiring providers
and API mocks so your real components render in isolation.

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
`.scenar/` registry and packed bundles stay out of your product repo. You can
also keep it in a `demos/` folder inside your app repo, or as a workspace member
in a monorepo — the only difference is where these files land.

In an empty directory, run `scenar install` with the component package(s) you
want to demo:

```bash
npx @scenar/cli install @your-org/ui
```

Or ask the AI: *"Run scenar install with @your-org/ui."* (it calls
`scenar_install`). This one command:

- scaffolds a `package.json` and a starter view if the directory is empty,
- adds `@your-org/ui` (plus `@scenar/*` and React) as dependencies and runs your
  package manager,
- scans your local `src/` views and writes the `.scenar/` registry.

Specs are resolver-agnostic — a registry version (`@your-org/ui@1.2.0`),
`workspace:*`, `file:../ui`, or a git URL all work. Inside a monorepo the
project is detected as a workspace member and the install runs at the root.

`.scenar/` contains:

| File | Owner | Purpose |
|------|-------|---------|
| `views.generated.ts` | scanner | discovered components — never edit |
| `views.custom.tsx` | you | hand-added views |
| `views.ts` | you | the merged registry you author against |
| `providers.tsx` | you | wrap components in the providers they need |
| `report.md` | scanner | what was discovered/skipped, and why |

It also installs an MSW (Mock Service Worker) service worker into your public
directory.

**You author the views.** Compose your real components into the screens you want
to narrate under `src/`, then re-run `scenar install` to refresh the registry —
generated files are rewritten; your `views.custom.tsx`, `providers.tsx`, and
scenario sources are preserved.

**What to commit.** Version-control the files you own — `views.ts`,
`views.custom.tsx`, `providers.tsx`, and your scenario sources
(`steps.ts`/`index.tsx`). Ignore regenerable output:

```gitignore
*-bundle/                    # packed embeds (rebuild with `scenar pack`)
.scenar/views.generated.ts   # re-created by `scenar install`
```

**Read `report.md` first.** It tells you which components were found, which were
skipped, and what props/providers they expect.

## 3. Wire providers and mocks (the manual step)

Real components rarely render in a vacuum — they need a theme, a router, a query
client, auth context, etc., and their data fetches need to resolve. This is the
one part the scanner can't do for you.

1. **Providers.** Edit `.scenar/providers.tsx` to wrap children in the providers
   your components require:

   ```tsx
   export function Providers({ children }: { children: React.ReactNode }) {
     return (
       <ThemeProvider theme={demoTheme}>
         <QueryClientProvider client={new QueryClient()}>
           <MemoryRouter>{children}</MemoryRouter>
         </QueryClientProvider>
       </ThemeProvider>
     );
   }
   ```

2. **API mocks.** Add MSW handlers so fetches resolve with realistic fixtures:

   ```ts
   import { http, HttpResponse } from "msw";

   export const handlers = [
     http.get("/api/projects", () =>
       HttpResponse.json([{ id: "1", name: "checkout-api", status: "healthy" }]),
     ),
   ];
   ```

   Wire these into the generated MSW setup so the preview uses them.

Tip: keep fixtures small and representative — they become the data your tour
shows.

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
  add it to `.scenar/providers.tsx` or your MSW handlers.
- **`pack` fails on an SVG.** SVG isn't a served file type. Inline it as a React
  component or a `data:` URI. See [authoring-scenarios.md](authoring-scenarios.md#bundle-constraints).
- **`publish` says gh isn't authenticated.** Run `gh auth login`.
- **Interactions fire at the wrong time.** `atPercent` is measured against the
  step's narration duration; narrate first, or set explicit `delayMs` for muted
  tours.
