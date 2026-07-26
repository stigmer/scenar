import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");

/**
 * The agent-facing skill ships twice by design: once in-repo for this
 * workspace's own agents (`.cursor/skills/scenar/`) and once inside the
 * published `@scenar/mcp-server` package (`packages/mcp-server/skill/`),
 * which integrators copy into their projects (see README). There is no
 * build step keeping them aligned — this test is the sync mechanism.
 * `docs/authoring-scenarios.md` defers to the skill as the source of
 * truth, so silent drift here would mislead every agent that reads it.
 *
 * If this fails: edit one copy, `cp` it over the other, commit both.
 */
const SKILL_FILE_PAIRS = ["SKILL.md", "reference.md"] as const;

describe("skill copies", () => {
  for (const file of SKILL_FILE_PAIRS) {
    it(`${file} is byte-identical between .cursor/skills/scenar and packages/mcp-server/skill`, () => {
      const workspaceCopy = readFileSync(
        resolve(root, ".cursor/skills/scenar", file),
        "utf8",
      );
      const publishedCopy = readFileSync(
        resolve(root, "packages/mcp-server/skill", file),
        "utf8",
      );
      expect(publishedCopy).toBe(workspaceCopy);
    });
  }
});
