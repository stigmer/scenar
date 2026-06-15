import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./tools.js";
import { registerResources } from "./resources.js";

/** The server's advertised version (kept in step with the package). */
export const SERVER_VERSION = "0.0.1";

/**
 * Build a fully-configured Scenar MCP server (tools + resources registered),
 * ready to connect to a transport. Factored out so tests can construct it
 * without standing up stdio.
 */
export function createScenarServer(): McpServer {
  const server = new McpServer({
    name: "scenar",
    version: SERVER_VERSION,
  });

  registerTools(server);
  registerResources(server);

  return server;
}
