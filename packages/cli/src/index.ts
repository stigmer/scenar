import { Command } from "commander";
import { registerValidateCommand } from "./commands/validate.js";
import { registerNarrateCommand } from "./commands/narrate.js";
import { registerInstallCommand } from "./commands/install.js";
import { registerRenderCommand } from "./commands/render.js";
import { registerPackCommand } from "./commands/pack.js";
import { registerShootCommand } from "./commands/shoot.js";
import { registerServeCommand } from "./commands/serve.js";
import { registerTryCommand } from "./commands/try.js";
import { registerPublishCommand } from "./commands/publish.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("scenar")
    .description("Scenar CLI — install a demos project, author scenarios, then pack, serve, and publish embeds.")
    .version("0.0.1");

  registerValidateCommand(program);
  registerNarrateCommand(program);
  registerRenderCommand(program);
  registerInstallCommand(program);
  registerPackCommand(program);
  registerShootCommand(program);
  registerServeCommand(program);
  registerTryCommand(program);
  registerPublishCommand(program);

  return program;
}

export function run(argv: string[]): void {
  const program = createProgram();
  program.parse(argv);
}
