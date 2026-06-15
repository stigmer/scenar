# The Scenar MCP server

`@scenar/mcp-server` exposes the Scenar pipeline to AI editors over the
[Model Context Protocol](https://modelcontextprotocol.io). With it installed,
your editor can scan an app, author a scenario, narrate, pack, serve, and publish
— all from natural-language requests. It's a thin, type-safe wrapper over the
`@scenar/cli` programmatic API (no shelling out).

## Install in Cursor

Add to `.cursor/mcp.json` (project-level) or your global Cursor MCP config:

```json
{
  "mcpServers": {
    "scenar": { "command": "npx", "args": ["-y", "@scenar/mcp-server"] }
  }
}
```

Then add the skill so the model knows the authoring model:

```bash
mkdir -p .cursor/skills
cp -R node_modules/@scenar/mcp-server/skill .cursor/skills/scenar
```

Restart Cursor. The `scenar` server and its tools should appear in the MCP panel.

## Other editors

Any MCP-capable client works (Claude Desktop, Windsurf, Zed, etc.). The command
is the same — register a stdio server that runs `npx -y @scenar/mcp-server`. For
a pinned global install:

```bash
npm install -g @scenar/mcp-server
# then use command: "scenar-mcp", args: []
```

## Tools

| Tool | What it does |
|------|-------------|
| `scenar_preview_init` | Scan a React project → `.scenar/` registry + report |
| `scenar_preview_sync` | Re-scan after code changes (preserves your edits) |
| `scenar_validate` | Validate a scenario YAML or directory |
| `scenar_narrate` | Synthesize TTS audio for a scenario |
| `scenar_pack` | Bundle a scenario into a static embed |
| `scenar_serve` | Serve a packed bundle locally; returns the URL |
| `scenar_stop_serve` | Stop a server started by `scenar_serve` |
| `scenar_publish` | Deploy a packed bundle to GitHub Pages; returns the URL |
| `scenar_render` | Render a scenario to MP4 |

Preview servers started via `scenar_serve` outlive a single tool call, so the AI
can pack → serve → keep iterating, then `scenar_stop_serve` when done.

## Resources

Read-only context the model can inspect:

| Resource | Provides |
|----------|----------|
| `scenar://registry/views` | the merged view registry (`.scenar/views.ts`) |
| `scenar://registry/report` | the scan report — discovered/skipped and why |
| `scenar://registry/providers` | current provider wiring |
| `scenar://scenario/{name}/steps` | step definitions for a named scenario |
| `scenar://scenario/{name}/manifest` | the pack manifest (after packing) |

## Working directory

The server resolves paths against the editor's project root. Run your editor from
the repository you're authoring in so relative paths like `./src` and `./my-tour`
resolve correctly.

## Verifying

Ask the AI: *"List the Scenar MCP tools and validate the welcome-tour example."*
It should call `scenar_validate` against
`packages/cli/examples/welcome-tour` and report success.
