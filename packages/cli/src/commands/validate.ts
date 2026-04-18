import { Command } from "commander";
import { loadScenarioYaml } from "../util/load-yaml.js";
import { validateScenario } from "../validate/scenario-validator.js";

interface ValidateOptions {
  json?: boolean;
}

export function registerValidateCommand(program: Command): void {
  program
    .command("validate")
    .description("Validate a scenario YAML file against the proto schema.")
    .argument("<file>", "path to scenario YAML file")
    .option("--json", "output validation result as JSON")
    .action(async (file: string, options: ValidateOptions) => {
      await runValidate(file, options);
    });
}

export async function runValidate(
  file: string,
  options: ValidateOptions,
): Promise<void> {
  const scenario = await loadScenarioYaml(file);
  const result = validateScenario(scenario);

  if (options.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    if (!result.valid) process.exitCode = 1;
    return;
  }

  if (result.valid) {
    process.stdout.write(`\x1b[32m✓\x1b[0m Scenario is valid: ${file}\n`);
    return;
  }

  process.stderr.write(`\x1b[31m✗\x1b[0m Scenario has ${result.errors.length} error(s): ${file}\n\n`);
  for (const error of result.errors) {
    process.stderr.write(`  \x1b[31m•\x1b[0m ${error.path}: ${error.reason}\n`);
  }
  process.stderr.write("\n");
  process.exitCode = 1;
}
