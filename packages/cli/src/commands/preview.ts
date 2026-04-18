import * as path from "path";
import { Command } from "commander";
import { scanProject, generate } from "@scenar/preview";

interface PreviewInitOptions {
  dir?: string;
  output?: string;
  resetProviders?: boolean;
}

interface PreviewSyncOptions {
  dir?: string;
  output?: string;
}

export function registerPreviewCommand(program: Command): void {
  const preview = program
    .command("preview")
    .description("Scan a React project and generate a preview view registry.");

  preview
    .command("init")
    .description("Scan the project and generate the .scenar/ directory.")
    .option("-d, --dir <path>", "project root directory (default: cwd)")
    .option("-o, --output <path>", "output directory (default: .scenar)")
    .option("--reset-providers", "force-regenerate providers.tsx")
    .action(async (options: PreviewInitOptions) => {
      await runPreviewInit(options);
    });

  preview
    .command("sync")
    .description("Re-scan and update scanner-owned files (preserves user files).")
    .option("-d, --dir <path>", "project root directory (default: cwd)")
    .option("-o, --output <path>", "output directory (default: .scenar)")
    .action(async (options: PreviewSyncOptions) => {
      await runPreviewSync(options);
    });
}

async function runPreviewInit(options: PreviewInitOptions): Promise<void> {
  const projectRoot = path.resolve(options.dir ?? process.cwd());
  const outputDir = options.output ?? ".scenar";

  process.stdout.write(`\x1b[36m●\x1b[0m Scanning project: ${projectRoot}\n`);

  const scanResult = scanProject(projectRoot);

  process.stdout.write(
    `  Found ${scanResult.discovered.length} components, ` +
    `skipped ${scanResult.skipped.length}\n`,
  );
  process.stdout.write(
    `  Framework: ${scanResult.framework}, ` +
    `entry: ${scanResult.entryPoint ?? "none detected"}\n`,
  );

  if (scanResult.detectedProviders.length > 0) {
    process.stdout.write(
      `  Providers: ${scanResult.detectedProviders.join(", ")}\n`,
    );
  }

  process.stdout.write(`\n\x1b[36m●\x1b[0m Generating ${outputDir}/\n`);

  const result = generate(scanResult, {
    projectRoot,
    outputDir,
    isInit: true,
    resetProviders: options.resetProviders,
  });

  for (const file of result.written) {
    process.stdout.write(`  \x1b[32m✓\x1b[0m ${file}\n`);
  }
  for (const file of result.preserved) {
    process.stdout.write(`  \x1b[33m●\x1b[0m ${file} (preserved)\n`);
  }

  process.stdout.write(`\n\x1b[32m✓\x1b[0m Preview initialized.\n`);
  process.stdout.write(`  Review ${outputDir}/report.md for scan details.\n`);
  process.stdout.write(`  Add custom views in ${outputDir}/views.custom.tsx.\n`);
  process.stdout.write(`  Customize providers in ${outputDir}/providers.tsx.\n`);
}

async function runPreviewSync(options: PreviewSyncOptions): Promise<void> {
  const projectRoot = path.resolve(options.dir ?? process.cwd());
  const outputDir = options.output ?? ".scenar";

  process.stdout.write(`\x1b[36m●\x1b[0m Re-scanning project: ${projectRoot}\n`);

  const scanResult = scanProject(projectRoot);

  process.stdout.write(
    `  Found ${scanResult.discovered.length} components, ` +
    `skipped ${scanResult.skipped.length}\n`,
  );

  process.stdout.write(`\n\x1b[36m●\x1b[0m Updating ${outputDir}/\n`);

  const result = generate(scanResult, {
    projectRoot,
    outputDir,
    isInit: false,
  });

  for (const file of result.written) {
    process.stdout.write(`  \x1b[32m✓\x1b[0m ${file} (updated)\n`);
  }
  for (const file of result.preserved) {
    process.stdout.write(`  \x1b[33m●\x1b[0m ${file} (preserved)\n`);
  }

  process.stdout.write(`\n\x1b[32m✓\x1b[0m Preview synced.\n`);
}
