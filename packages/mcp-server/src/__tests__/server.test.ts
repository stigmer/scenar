import { describe, it, expect } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createScenarServer } from "../server.js";

async function connectClient(): Promise<Client> {
  const server = createScenarServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe("Scenar MCP server", () => {
  it("exposes all expected tools", async () => {
    const client = await connectClient();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "scenar_install",
        "scenar_narrate",
        "scenar_pack",
        "scenar_publish",
        "scenar_render",
        "scenar_serve",
        "scenar_shoot",
        "scenar_stop_serve",
        "scenar_validate",
      ].sort(),
    );
  });

  it("exposes the per-scenario resource templates", async () => {
    const client = await connectClient();
    const { resourceTemplates } = await client.listResourceTemplates();
    const templates = resourceTemplates.map((t) => t.uriTemplate);
    expect(templates).toContain("scenar://scenario/{name}/steps");
    expect(templates).toContain("scenar://scenario/{name}/manifest");
  });

  it("validates a scenario via the scenar_validate tool", async () => {
    const dir = await mkdtemp(join(tmpdir(), "scenar-mcp-"));
    try {
      const file = join(dir, "bad.yaml");
      // Missing required fields → the validator should report errors.
      await writeFile(file, "kind: Scenario\n", "utf-8");

      const client = await connectClient();
      const result = (await client.callTool({
        name: "scenar_validate",
        arguments: { file },
      })) as { content: Array<{ type: string; text: string }> };

      const body = result.content.map((c) => c.text).join("\n");
      expect(body).toContain("Invalid");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("reads a scenario steps resource, returning guidance when absent", async () => {
    const client = await connectClient();
    const result = await client.readResource({
      uri: "scenar://scenario/nope/steps",
    });
    expect(result.contents).toHaveLength(1);
    // With no such scenario in the test cwd, the body should guide the user.
    const text = String(result.contents[0]!.text);
    expect(text.length).toBeGreaterThan(0);
  });
});
