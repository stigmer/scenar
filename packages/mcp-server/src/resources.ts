import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { projectRoot, readProjectFile } from "./project.js";

/**
 * Register read-only resources the AI can inspect for authoring context: the
 * generated view registry + scan report (in .scenar/), and per-scenario steps +
 * pack manifest. All are read relative to the project root; a missing file
 * returns a short explanatory body rather than an error so the client degrades
 * gracefully.
 */
export function registerResources(server: McpServer): void {
  registerRegistryFile(
    server,
    "scenar-views",
    "scenar://registry/views",
    "Scenar view registry",
    "The generated .scenar/views.ts — the components available to scenarios.",
    ".scenar/views.ts",
    "text/plain",
  );
  registerRegistryFile(
    server,
    "scenar-report",
    "scenar://registry/report",
    "Scenar scan report",
    "The .scenar/report.md — what the scanner discovered, skipped, and why.",
    ".scenar/report.md",
    "text/markdown",
  );
  registerRegistryFile(
    server,
    "scenar-providers",
    "scenar://registry/providers",
    "Scenar provider wiring",
    "The .scenar/providers.tsx — how real components are wrapped for preview.",
    ".scenar/providers.tsx",
    "text/plain",
  );

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

function registerRegistryFile(
  server: McpServer,
  id: string,
  uri: string,
  title: string,
  description: string,
  relativePath: string,
  mimeType: string,
): void {
  server.registerResource(id, uri, { title, description, mimeType }, async (u) => {
    const body = await readProjectFile(relativePath);
    return {
      contents: [
        {
          uri: u.href,
          mimeType,
          text: body ?? `No ${relativePath} yet. Run scenar_preview_init to generate it.`,
        },
      ],
    };
  });
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
