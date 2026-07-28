import { Command } from "commander";
import { runShoot } from "../shoot/run-shoot.js";
import type { ShotTheme } from "../shoot/types.js";

interface ShootOptions {
  theme: string;
  verify?: boolean;
  timeout: string;
}

const THEME_CHOICES = ["light", "dark", "both"] as const;

export function registerShootCommand(program: Command): void {
  program
    .command("shoot")
    .description(
      "Render a packed bundle's declared shots to still images.\n\n" +
        "Reads the steps' `shot` names from the running bundle, walks the\n" +
        "timeline sequentially (a deterministic TimeSource walk — the same\n" +
        "model as video export), and screenshots each shot's settled\n" +
        "end-of-step frame into <bundle>/stills/<shot>.<theme>.png, one\n" +
        "image per theme. The pack manifest is rebuilt afterwards, so\n" +
        "`scenar publish` and deploys ship the stills with the bundle.\n\n" +
        "Requires Playwright (optional peer): npm install -D playwright,\n" +
        "then npx playwright install chromium. The bundle must be packed by\n" +
        "the same CLI version (all @scenar packages release in lockstep).\n\n" +
        "Tip: open <bundle-url>?shot=<name> in a browser to eyeball any\n" +
        "declared shot without capturing.",
    )
    .argument("<dir>", "a packed bundle directory (from scenar pack)")
    .option("--theme <theme>", `themes to capture: ${THEME_CHOICES.join(" | ")} (default: both)`, "both")
    .option(
      "--verify",
      "capture everything twice in fresh browser sessions and fail unless every still is byte-identical",
    )
    .option("--timeout <ms>", "per-page readiness timeout in milliseconds (default: 30000)", "30000")
    .action(async (dir: string, options: ShootOptions) => {
      try {
        if (!(THEME_CHOICES as readonly string[]).includes(options.theme)) {
          throw new Error(`--theme must be one of: ${THEME_CHOICES.join(", ")}`);
        }
        const themes: readonly ShotTheme[] =
          options.theme === "both" ? ["light", "dark"] : [options.theme as ShotTheme];

        const result = await runShoot({
          bundleDir: dir,
          themes,
          verify: options.verify ?? false,
          timeoutMs: Number(options.timeout) || undefined,
          onLog: (message) => process.stderr.write(`${message}\n`),
        });

        if (result.shots.length === 0) {
          process.stderr.write(
            `\n\x1b[32m✓\x1b[0m No shots declared in ${result.scenarioId} — nothing captured.\n` +
              `  Name a capture point by setting \`shot: "<kebab-name>"\` on a step.\n`,
          );
          return;
        }
        process.stderr.write(
          `\n\x1b[32m✓\x1b[0m Shot ${result.files.length} stills ` +
            `(${result.shots.length} shots x ${result.themes.length} themes)` +
            `${result.verified ? ", byte-identical across sessions" : ""} ` +
            `to ${result.bundleDir}/stills\n`,
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        process.stderr.write(`\x1b[31mError:\x1b[0m ${msg}\n`);
        process.exitCode = 1;
      }
    });
}
