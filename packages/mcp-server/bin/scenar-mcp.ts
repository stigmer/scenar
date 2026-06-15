#!/usr/bin/env node
import { main } from "../src/index.js";

main().catch((error: unknown) => {
  process.stderr.write(`scenar-mcp: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
