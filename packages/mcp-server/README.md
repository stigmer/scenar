# @scenar/mcp-server

The [Model Context Protocol](https://modelcontextprotocol.io) server for
[Scenar](https://github.com/stigmer/scenar) — it lets AI editors (Cursor, Claude
Desktop, etc.) scan a React app, author a scenario tour, narrate it, pack it, and
serve or publish the embed. A thin, type-safe wrapper over the `@scenar/cli`
programmatic API.

## Install in Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "scenar": { "command": "npx", "args": ["-y", "@scenar/mcp-server"] }
  }
}
```

Then add the bundled authoring skill so the model knows the scenario model:

```bash
mkdir -p .cursor/skills
cp -R node_modules/@scenar/mcp-server/skill .cursor/skills/scenar
```

Restart your editor.

## Tools

| Tool | What it does |
|------|-------------|
| `scenar_install` | Bootstrap a demos project → add deps + `.scenar/` registry |
| `scenar_validate` | Validate a scenario YAML or directory |
| `scenar_narrate` | Synthesize TTS audio for a scenario |
| `scenar_pack` | Bundle a scenario into a static embed |
| `scenar_serve` | Serve a packed bundle locally; returns the URL |
| `scenar_stop_serve` | Stop a server started by `scenar_serve` |
| `scenar_publish` | Deploy a packed bundle to GitHub Pages; returns the URL |
| `scenar_render` | Render a scenario to MP4 |

## Resources

`scenar://registry/views`, `scenar://registry/report`,
`scenar://registry/providers`, `scenar://scenario/{name}/steps`, and
`scenar://scenario/{name}/manifest` expose read-only context the model can
inspect.

See the [Scenar docs](https://github.com/stigmer/scenar/blob/main/docs/mcp-server.md)
for configuration in other editors.

## License

Apache-2.0
