import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createScenarServer } from "./server.js";
import { stopAllServers } from "./serve-registry.js";

export { createScenarServer, SERVER_VERSION } from "./server.js";

/**
 * Start the Scenar MCP server over stdio (how Cursor and other editors launch
 * it). Stays alive until the transport closes, then stops any preview servers
 * started during the session.
 */
export async function main(): Promise<void> {
  const server = createScenarServer();
  const transport = new StdioServerTransport();

  const shutdown = () => {
    void stopAllServers().finally(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await server.connect(transport);
}
