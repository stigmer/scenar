import * as path from "path";
import { Command } from "commander";
import { runInstall, type PackageManager } from "../install/run-install.js";

interface InstallCommandOptions {
  dir?: string;
  install?: boolean; // commander sets this to false for --no-install
  packageManager?: string;
}

const PACKAGE_MANAGERS: readonly PackageManager[] = ["npm", "yarn", "pnpm"];

export function registerInstallCommand(program: Command): void {
  program
    .command("install")
    .description(
      "Bootstrap a Scenar demos project in one step.\n\n" +
        "Scaffolds a package.json and a runnable starter tour under\n" +
        "tours/example-tour/ if the directory is empty, adds the given\n" +
        "component packages as ordinary dependencies, and runs your package\n" +
        "manager. Re-run any time — existing files are never overwritten, so\n" +
        "your authored tours are always preserved.\n\n" +
        "Component packages are consumed as normal dependencies — import and\n" +
        "compose them into the tours you author under tours/. Specs are\n" +
        "resolver-agnostic: a registry version (@stigmer/react@1.2.0),\n" +
        "workspace:*, file:../pkg, or a git URL all work; resolution is your\n" +
        "package manager's job.\n\n" +
        "Inside a monorepo, the project is detected as a workspace member and\n" +
        "the install runs at the workspace root.",
    )
    .argument(
      "[packages...]",
      "component packages to add as dependencies (e.g. @stigmer/react)",
    )
    .option("--dir <path>", "project directory (default: current directory)")
    .option("--no-install", "scaffold and record dependencies but skip the install")
    .option(
      "--package-manager <pm>",
      "force npm | yarn | pnpm instead of auto-detecting",
    )
    .action(async (packages: string[], options: InstallCommandOptions) => {
      try {
        const cwd = path.resolve(options.dir ?? process.cwd());

        const installResult = runInstall({
          cwd,
          packages: packages ?? [],
          onLog: (line) => process.stderr.write(`${line}\n`),
          skipInstall: options.install === false,
          packageManager: parsePackageManager(options.packageManager),
        });

        printNextSteps(cwd, installResult.installRan);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        process.stderr.write(`\x1b[31mError:\x1b[0m ${msg}\n`);
        process.exitCode = 1;
      }
    });
}

function parsePackageManager(value: string | undefined): PackageManager | undefined {
  if (value === undefined) return undefined;
  if ((PACKAGE_MANAGERS as readonly string[]).includes(value)) {
    return value as PackageManager;
  }
  throw new Error(
    `invalid --package-manager "${value}"; expected one of ${PACKAGE_MANAGERS.join(", ")}.`,
  );
}

function printNextSteps(cwd: string, installRan: boolean): void {
  const rel = path.relative(process.cwd(), cwd);
  // Prefer a short relative path, but fall back to the absolute path when the
  // target is outside the current directory (avoids a wall of "../").
  const where = rel === "" ? "." : rel.startsWith("..") ? cwd : rel;
  process.stderr.write(`\n\x1b[32m✓\x1b[0m Scenar demos project ready in ${where}/\n`);
  if (!installRan) {
    process.stderr.write(
      `  \x1b[33m●\x1b[0m Install skipped — run your package manager before packing.\n`,
    );
  }
  process.stderr.write(`  Next:\n`);
  process.stderr.write(`    1. \`scenar pack tours/example-tour\` to preview the starter tour.\n`);
  process.stderr.write(`    2. Edit tours/example-tour/index.tsx — swap the shells for your\n`);
  process.stderr.write(`       real components (add them with \`scenar install <your-pkg>\`).\n`);
  process.stderr.write(`    3. Wire any data they fetch in tours/example-tour/.scenar/providers.tsx.\n`);
  process.stderr.write(`    4. \`scenar pack\` then \`scenar publish\` to ship the embed.\n`);
}
