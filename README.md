<div align="center">

# Scenar

**Turn your React app into a narrated, interactive product tour — authored by your AI editor.**

Point Cursor at your app, describe the tour in plain English, and get an embeddable demo (and an MP4) from your real components. Same source, two outputs.

[![License](https://img.shields.io/github/license/stigmer/scenar)](LICENSE)
[![npm](https://img.shields.io/npm/v/@scenar/react)](https://www.npmjs.com/package/@scenar/react)
[![GitHub stars](https://img.shields.io/github/stars/stigmer/scenar?style=flat)](https://github.com/stigmer/scenar/stargazers)

[**Live example →**](https://stigmer.github.io/scenar-welcome-tour/)

</div>

---

## How it works

```mermaid
flowchart LR
    A["Your React app"] -->|"scenar install"| B[".scenar/ demos project"]
    B -->|"AI + Scenar skill"| C["Scenario<br/>(steps.ts + index.tsx)"]
    C -->|"scenar narrate"| D["TTS narration"]
    D -->|"scenar pack"| E["Static embed bundle"]
    E -->|"scenar serve"| F["Local preview"]
    E -->|"scenar publish"| G["Public GitHub Pages URL"]
    E -->|"scenar render"| H["MP4 video"]
```

You bring the app. The AI — guided by the Scenar skill and the Scenar MCP server
— scans your components, writes the scenario, and runs the pipeline. You review,
tweak the wording and pacing, and ship.

## The 5-minute path

> Every command below is real and runnable. Prefer driving these through your AI
> editor (it has the [Scenar skill](#2-add-the-scenar-skill) and the MCP tools),
> but you can run them by hand too.

### 1. Add the Scenar MCP server to your editor

In Cursor, add this to `.cursor/mcp.json` (or your editor's MCP config):

```json
{
  "mcpServers": {
    "scenar": {
      "command": "npx",
      "args": ["-y", "@scenar/mcp-server"]
    }
  }
}
```

This exposes tools like `scenar_pack`, `scenar_serve`, and `scenar_publish` to
the AI. See [docs/mcp-server.md](docs/mcp-server.md).

### 2. Add the Scenar skill

Copy the skill into your project so the AI knows how to author scenarios:

```bash
mkdir -p .cursor/skills
cp -R node_modules/@scenar/mcp-server/skill .cursor/skills/scenar
# or copy .cursor/skills/scenar/ from this repo
```

The skill teaches the AI the full step / view / interaction / narration model.

### 3. Create a demos project

Run this in a new, empty directory (e.g. `your-app-demos`), kept separate so the
`.scenar/` registry and packed bundles stay out of your product repo:

```bash
npx @scenar/cli install @your-org/ui
```

`scenar install` scaffolds a `package.json` and a starter view, adds your
component package(s) as ordinary dependencies, runs your package manager, and
generates the `.scenar/` registry from your local views. Your real components
arrive as a normal dependency — author tour screens under `src/` that import
from `@your-org/ui` and compose them. Re-run `scenar install` any time to
refresh: generated files are rewritten; your `providers.tsx`, `views.custom.tsx`,
and scenarios are preserved. Nothing leaves your machine until you `publish`
(step 6).

Specs are resolver-agnostic — a registry version (`@your-org/ui@1.2.0`),
`workspace:*`, `file:../ui`, or a git URL all work; resolution is your package
manager's job. Inside a monorepo, the demos project is detected as a workspace
member and the install runs at the workspace root.

### 4. Ask the AI to build a tour

> "Build a Scenar tour of our onboarding flow: sign-up, workspace setup, and the
> dashboard. Keep it to four steps."

The AI writes `steps.ts` + `index.tsx` against your real components. You'll wire
`.scenar/providers.tsx` and MSW handlers together (the one step that needs a
human — see [docs/getting-started.md](docs/getting-started.md)).

If your components rely on a Tailwind/CSS build, import the package's prebuilt
stylesheet (e.g. `@your-org/ui/styles.css`) in `.scenar/providers.tsx` —
`scenar pack` bundles JS, not Tailwind.

### 5. Narrate, pack, and preview

```bash
npx @scenar/cli narrate ./my-tour      # synthesize voiceover from step text
npx @scenar/cli pack ./my-tour         # bundle into a static embed
npx @scenar/cli serve ./my-tour-bundle # → http://localhost:4173/
```

### 6. Publish a public URL

```bash
npx @scenar/cli publish ./my-tour-bundle
# → https://<you>.github.io/scenar-embeds/my-tour/  (+ a ready-to-paste <iframe> snippet)
```

Needs the [GitHub CLI](https://cli.github.com) authenticated (`gh auth login`).
Paste the snippet into any page.

### Where your embeds live

You don't add anything to your app's source repo. The first time you `publish`,
Scenar creates **one dedicated public repo named `scenar-embeds`** under your
GitHub account and serves your tour from GitHub Pages:

```
github.com/<you>/scenar-embeds   → gh-pages branch
├── welcome-tour/    → https://<you>.github.io/scenar-embeds/welcome-tour/
├── onboarding/      → https://<you>.github.io/scenar-embeds/onboarding/
└── billing-demo/    → https://<you>.github.io/scenar-embeds/billing-demo/
```

Every tour gets its own path, so publishing (or re-publishing) one never touches
the others — and your application's repository stays untouched. Override the
target with `--repo`, `--path`, or publish under an organization with `--org`.
See [docs/hosting.md](docs/hosting.md).

## Try it now (no app required)

```bash
npx @scenar/cli try   # serves the bundled welcome-tour at http://localhost:4173/
```

Open the printed URL — you'll see the same demo as the
[live example](https://stigmer.github.io/scenar-welcome-tour/).

## What you can build

- **Interactive embeds** — narrated, self-playing tours with an animated cursor,
  typing, scrolling, hovers, and viewport zooms. Drop the `<iframe>` anywhere.
- **MP4 videos** — `scenar render` produces a frame-accurate video from the
  *same* scenario, via Remotion.

## Two ways to author

- **Path A — your real components.** `scenar install` bootstraps a demos project
  with your component package as a dependency; you author local views that compose
  your real components against the generated registry. Highest fidelity. The one
  manual step is wiring providers + mock data so components render in isolation.
- **Path B — code / SDK.** Compose the `@scenar/react` shells and page templates
  (or your own components) with the type-safe `createScenario()` builder. No scan
  needed. The bundled [`welcome-tour`](packages/cli/examples/welcome-tour) is
  Path B.

See [docs/authoring-scenarios.md](docs/authoring-scenarios.md) for the full model.

## Hosting your embed

| Tier | Command | URL | Notes |
|------|---------|-----|-------|
| Local | `scenar serve` | `http://localhost:4173/` | Ephemeral, zero setup |
| GitHub Pages | `scenar publish` | `https://<you>.github.io/scenar-embeds/<slug>/` | Public, free, permanent; a dedicated `scenar-embeds` repo, many tours per repo |

Details in [docs/hosting.md](docs/hosting.md).

## CLI reference

```bash
scenar install [packages...]         # bootstrap a demos project: scaffold + add deps + scan → .scenar/
scenar validate demo.yaml            # validate a scenario YAML
scenar try                           # serve the bundled welcome-tour example (no app needed)
scenar narrate ./my-tour             # synthesize narration audio (TTS)
scenar pack ./my-tour                # bundle into a static embed
scenar serve ./my-tour-bundle        # preview locally
scenar publish ./my-tour-bundle      # publish to GitHub Pages
scenar render ./my-tour              # export an MP4 (Remotion)
```

Install the CLI globally with `npm install -g @scenar/cli`, or run it via `npx
@scenar/cli <command>`.

## Packages

| Package | What it does |
|---------|-------------|
| [`@scenar/core`](packages/core) | Types, timeline math, step actions, embed protocol — no framework dependency |
| [`@scenar/embed`](packages/embed) | `<scenar-embed>` web component + React wrapper for dropping a hosted tour on any page |
| [`@scenar/sdk`](packages/sdk) | `createScenario()` builder + proto/YAML loader |
| [`@scenar/react`](packages/react) | `ScenarioPlayer`, cursor, viewport, narration, shells, page templates |
| [`@scenar/preview`](packages/preview) | Scan a React project, generate a view registry automatically |
| [`@scenar/cli`](packages/cli) | `install`, `validate`, `narrate`, `pack`, `serve`, `publish`, `render` |
| [`@scenar/mcp-server`](packages/mcp-server) | MCP server exposing the CLI to AI editors |
| [`@scenar/remotion`](packages/remotion) | MP4 video export |

## Documentation

- [Getting started](docs/getting-started.md) — the full walkthrough, including provider + MSW wiring
- [Authoring scenarios](docs/authoring-scenarios.md) — the step / view / interaction / narration model
- [MCP server](docs/mcp-server.md) — installing and configuring the MCP server
- [Hosting](docs/hosting.md) — `serve` vs `publish`, custom domains
- [Embedding](docs/embedding.md) — the no-JS snippet and the `<scenar-embed>` loader (auto-fit + theme sync)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

- [GitHub Issues](https://github.com/stigmer/scenar/issues) — bugs and feature requests

## License

Apache License 2.0. See [LICENSE](LICENSE).
