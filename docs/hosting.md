# Hosting your embed

A packed bundle (the output of `scenar pack`) is a self-contained static site. It
runs anywhere static files do. Scenar gives you three tiers, from zero-setup local
preview to a fully managed cloud.

| Tier | Command | URL | Best for |
|------|---------|-----|----------|
| Local | `scenar serve` | `http://localhost:4173/` | Iterating while you author |
| GitHub Pages | `scenar publish` | `https://<owner>.github.io/scenar-embeds/<slug>/` | Free public hosting |
| Scenar Cloud | `scenar deploy` | CDN-backed embed URL | Custom domains, analytics, teams |

All three print a responsive `<iframe>` snippet pinned to the bundle's recorded
aspect ratio (from `scenario.json`).

## Where embeds live

Nothing is published into your application's source repo. The first time you
`scenar publish`, Scenar creates **one dedicated public repo named
`scenar-embeds`** under your GitHub account and serves your tours from its
`gh-pages` branch, each at its own path
(`https://<owner>.github.io/scenar-embeds/<slug>/`). Many tours coexist there,
and publishing or re-publishing one never disturbs the others. Override the
target repo with `--repo`, the subpath with `--path`, or publish under an
organization with `--org` (details below).

## Local — `scenar serve`

```bash
scenar serve ./my-tour-bundle            # → http://localhost:4173/
scenar serve ./my-tour-bundle --port 5000 --open
```

A minimal static server with strict path containment. Ephemeral and
developer-only — stop it with Ctrl+C. Ideal for the author → narrate → pack →
serve → tweak loop.

## GitHub Pages — `scenar publish`

```bash
scenar publish ./my-tour-bundle
# → https://<you>.github.io/scenar-embeds/my-tour/
```

By default, **many tours share one repo**. `--repo` defaults to `scenar-embeds`
and `--path` defaults to the packed scenario slug, so each tour lands in its own
subfolder and your app's source repo is never touched.

```bash
scenar publish ./welcome-bundle    # → .../scenar-embeds/welcome-tour/
scenar publish ./onboarding-bundle # → .../scenar-embeds/onboarding/  (welcome-tour untouched)
```

What it does:
- Creates or reuses the target repo (default `scenar-embeds`).
- Fetches the existing `gh-pages` branch and **replaces only this tour's
  subfolder**, preserving sibling tours. (Publishing identical content is a no-op.)
- Adds a root `.nojekyll` so assets serve raw.
- Enables GitHub Pages and waits for it to report ready.
- Prints the public URL and the `<iframe>` snippet.

Re-publishing a tour updates just its subfolder (idempotent). Requires the
[GitHub CLI](https://cli.github.com), authenticated:

```bash
gh auth login
```

Flags:
- `--repo <name>` — target repo (default `scenar-embeds`)
- `--path <subpath>` — subfolder within the repo (default: the scenario slug).
  Pass `--path /` to publish at the **repo root** — a dedicated single-tour repo
  whose every publish replaces the whole branch.
- `--org <org>` — publish under a GitHub organization
- `--private` — create the repo private (Pages needs a paid plan)
- `--message <msg>` — commit message for the snapshot

### One repo, many tours

A single `scenar-embeds` repo can hold any number of tours, each served from its
own path:

```
scenar-embeds/                 → gh-pages branch
├── .nojekyll
├── welcome-tour/   → https://<you>.github.io/scenar-embeds/welcome-tour/
├── onboarding/     → https://<you>.github.io/scenar-embeds/onboarding/
└── billing-demo/   → https://<you>.github.io/scenar-embeds/billing-demo/
```

Publishing or re-publishing one tour never disturbs the others.

### Custom domains on GitHub Pages

1. Add a `CNAME` file with your domain to the bundle (or the repo's `gh-pages`
   branch root).
2. Point a DNS `CNAME` record at `<owner>.github.io`.
3. Enable "Enforce HTTPS" in the repo's Pages settings.

The embed CSP allows the bundle to be framed from any origin, so a custom domain
just changes the URL you paste.

## Scenar Cloud — `scenar deploy`

The hosted offering: CDN-backed edge serving, custom domains, security headers,
deploy history, and analytics. The OSS `pack` output is already
contract-compatible (same allowlist, `pack-manifest.json`, and `scenario.json`),
so the same bundle deploys without changes:

```bash
scenar deploy ./my-tour-bundle
```

`deploy` targets a Scenar Cloud backend. Use `serve`/`publish` for the
self-hosted path; reach for `deploy` when you want a managed embed.

## Embedding

Paste the printed snippet into any page. It's a responsive `<iframe>` that
preserves the tour's aspect ratio:

```html
<div style="position:relative;width:100%;max-width:896px;aspect-ratio:896/480">
  <iframe
    src="https://<owner>.github.io/<repo>/"
    title="My tour"
    loading="lazy"
    style="position:absolute;inset:0;width:100%;height:100%;border:0"
    allow="autoplay; fullscreen"
    allowfullscreen
  ></iframe>
</div>
```
