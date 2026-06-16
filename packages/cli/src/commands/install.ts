import * as fs from "fs";
import * as path from "path";
import { Command } from "commander";
import { runInstall, type PackageManager } from "../install/run-install.js";
import { appendPackageReport } from "../install/package-report.js";
import { runGeneratePipeline } from "../preview/run-generate.js";

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
        "Scaffolds a package.json (and a starter view) if the directory is\n" +
        "empty, adds the given component packages as ordinary dependencies,\n" +
        "runs your package manager, and generates the .scenar/ registry from\n" +
        "your local views. Re-run any time to refresh: generated files are\n" +
        "rewritten; your providers.tsx, views.custom.tsx, and scenarios are\n" +
        "preserved.\n\n" +
        "Component packages are consumed as normal dependencies — compose them\n" +
        "into the views you author under src/. Specs are resolver-agnostic: a\n" +
        "registry version (@stigmer/react@1.2.0), workspace:*, file:../pkg, or\n" +
        "a git URL all work; resolution is your package manager's job.\n\n" +
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
        const outputDir = path.join(cwd, ".scenar");
        // First-time registry generation is keyed on the .scenar/ dir, not on
        // whether package.json existed — so `npm init` then `scenar install`
        // still scaffolds the registry's user-owned files.
        const isInit = !fs.existsSync(outputDir);

        const installResult = runInstall({
          cwd,
          packages: packages ?? [],
          onLog: (line) => process.stderr.write(`${line}\n`),
          skipInstall: options.install === false,
          packageManager: parsePackageManager(options.packageManager),
        });

        // Generating the registry needs the local views to exist on disk; the
        // install above has already placed any scaffolded starter view.
        process.stderr.write(`\n\x1b[36m●\x1b[0m Generating .scenar/\n`);
        const { scan, generate: gen, msw } = runGeneratePipeline({
          sourceRoot: cwd,
          outputDir,
          isInit,
          initMsw: true,
        });

        process.stderr.write(
          `  Found ${scan.discovered.length} components, ` +
            `skipped ${scan.skipped.length}\n`,
        );
        for (const file of gen.written) {
          process.stderr.write(`  \x1b[32m✓\x1b[0m ${file}\n`);
        }
        for (const file of gen.preserved) {
          process.stderr.write(`  \x1b[33m●\x1b[0m ${file} (preserved)\n`);
        }
        if (msw?.status === "created") {
          process.stderr.write(
            `  \x1b[32m✓\x1b[0m ${path.relative(cwd, msw.path!)}\n`,
          );
        }

        // Discovery aid: note the installed component packages in report.md.
        appendPackageReport(
          outputDir,
          cwd,
          installResult.added.map((spec) => spec.name),
        );

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
  process.stderr.write(`    1. Author tour views under src/ (compose your real components).\n`);
  process.stderr.write(`    2. Wire mock data in .scenar/providers.tsx.\n`);
  process.stderr.write(`    3. Re-run \`scenar install\` to refresh the registry.\n`);
  process.stderr.write(`    4. \`scenar pack\` then \`scenar publish\` to ship the embed.\n`);
}
