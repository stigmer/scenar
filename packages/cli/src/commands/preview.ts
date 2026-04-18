import * as path from "path";
import { Command } from "commander";
import { scanProject, generate, initMswServiceWorker } from "@scenar/preview";

interface PreviewInitOptions {
  source?: string;
  output?: string;
  resetProviders?: boolean;
}

interface PreviewSyncOptions {
  source?: string;
  output?: string;
}

export function registerPreviewCommand(program: Command): void {
  const preview = program
    .command("preview")
    .description("Scan a React project and generate a preview view registry.");

  preview
    .command("init")
    .description("Scan a project and generate the .scenar/ directory.")
    .option("-s, --source <path>", "project to scan (default: cwd)")
    .option("-o, --output <path>", "output directory for generated files (default: .scenar relative to cwd)")
    .option("--reset-providers", "force-regenerate providers.tsx")
    .action(async (options: PreviewInitOptions) => {
      await runPreviewInit(options);
    });

  preview
    .command("sync")
    .description("Re-scan and update scanner-owned files (preserves user files).")
    .option("-s, --source <path>", "project to scan (default: cwd)")
    .option("-o, --output <path>", "output directory for generated files (default: .scenar relative to cwd)")
    .action(async (options: PreviewSyncOptions) => {
      await runPreviewSync(options);
    });
}

async function runPreviewInit(options: PreviewInitOptions): Promise<void> {
  const sourceRoot = path.resolve(options.source ?? process.cwd());
  const outputDir = path.resolve(options.output ?? ".scenar");

  process.stdout.write(`\x1b[36m●\x1b[0m Scanning project: ${sourceRoot}\n`);

  const scanResult = scanProject(sourceRoot);

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

  const relOutput = path.relative(process.cwd(), outputDir);
  process.stdout.write(`\n\x1b[36m●\x1b[0m Generating ${relOutput}/\n`);

  const result = generate(scanResult, {
    sourceRoot,
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

  // --- MSW service worker ---
  const projectRoot = path.resolve(path.dirname(outputDir));
  const mswResult = initMswServiceWorker(projectRoot, scanResult.framework);

  if (mswResult.status === "created") {
    process.stdout.write(
      `\n\x1b[36m●\x1b[0m MSW service worker\n` +
      `  \x1b[32m✓\x1b[0m ${path.relative(process.cwd(), mswResult.path!)}\n`,
    );
  } else if (mswResult.status === "exists") {
    process.stdout.write(
      `\n\x1b[36m●\x1b[0m MSW service worker\n` +
      `  \x1b[33m●\x1b[0m ${path.relative(process.cwd(), mswResult.path!)} (exists)\n`,
    );
  } else if (mswResult.status === "error") {
    process.stdout.write(
      `\n\x1b[33m⚠\x1b[0m Could not generate MSW service worker: ${mswResult.error}\n` +
      `  Run \`npx msw init public/\` manually.\n`,
    );
  }

  process.stdout.write(`\n\x1b[32m✓\x1b[0m Preview initialized.\n`);
  process.stdout.write(`  Review ${relOutput}/report.md for scan details.\n`);
  process.stdout.write(`  Add custom views in ${relOutput}/views.custom.tsx.\n`);
  process.stdout.write(`  Customize providers in ${relOutput}/providers.tsx.\n`);
}

async function runPreviewSync(options: PreviewSyncOptions): Promise<void> {
  const sourceRoot = path.resolve(options.source ?? process.cwd());
  const outputDir = path.resolve(options.output ?? ".scenar");

  process.stdout.write(`\x1b[36m●\x1b[0m Re-scanning project: ${sourceRoot}\n`);

  const scanResult = scanProject(sourceRoot);

  process.stdout.write(
    `  Found ${scanResult.discovered.length} components, ` +
    `skipped ${scanResult.skipped.length}\n`,
  );

  const relOutput = path.relative(process.cwd(), outputDir);
  process.stdout.write(`\n\x1b[36m●\x1b[0m Updating ${relOutput}/\n`);

  const result = generate(scanResult, {
    sourceRoot,
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
