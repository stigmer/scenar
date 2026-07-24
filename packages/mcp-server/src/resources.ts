import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { projectRoot } from "./project.js";

/**
 * Register read-only resources the AI can inspect for authoring context: a
 * scenario's steps and its packed bundle's manifest. Both are read relative to
 * the project root; a missing file returns a short explanatory body rather than
 * an error so the client degrades gracefully.
 */
export function registerResources(server: McpServer): void {
  // Per-scenario resources: {name} is a scenario directory under the project.
  server.registerResource(
    "scenar-scenario-steps",
    new ResourceTemplate("scenar://scenario/{name}/steps", { list: undefined }),
    {
      title: "Scenario steps",
      description: "The steps.ts of a named scenario directory under the project root.",
    },
    async (uri, variables) => {
      const name = String(variables.name);
      const body = await readFirstExisting([
        join(projectRoot(), name, "steps.ts"),
        join(projectRoot(), name, "steps.tsx"),
      ]);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/plain",
            text: body ?? `No steps.ts found for scenario "${name}" under ${projectRoot()}.`,
          },
        ],
      };
    },
  );

  server.registerResource(
    "scenar-scenario-manifest",
    new ResourceTemplate("scenar://scenario/{name}/manifest", { list: undefined }),
    {
      title: "Scenario pack manifest",
      description: "The pack-manifest.json of a named scenario's packed bundle (<name>-bundle/).",
    },
    async (uri, variables) => {
      const name = String(variables.name);
      const body = await readFirstExisting([
        join(projectRoot(), `${name}-bundle`, "pack-manifest.json"),
        join(projectRoot(), name, "pack-manifest.json"),
      ]);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: body ?? `No pack-manifest.json found for "${name}". Run scenar_pack first.`,
          },
        ],
      };
    },
  );
}

async function readFirstExisting(paths: string[]): Promise<string | null> {
  for (const path of paths) {
    try {
      return await readFile(path, "utf-8");
    } catch {
      // try next
    }
  }
  return null;
}
