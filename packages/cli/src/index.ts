import { Command } from "commander";
import { registerValidateCommand } from "./commands/validate.js";
import { registerNarrateCommand } from "./commands/narrate.js";
import { registerPreviewCommand } from "./commands/preview.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("scenar")
    .description("Scenar CLI — validate scenarios, generate narration, and manage previews.")
    .version("0.0.1");

  registerValidateCommand(program);
  registerNarrateCommand(program);
  registerPreviewCommand(program);

  return program;
}

export function run(argv: string[]): void {
  const program = createProgram();
  program.parse(argv);
}
