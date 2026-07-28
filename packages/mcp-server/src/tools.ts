import { relative } from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  runInstall,
  runPack,
  runServe,
  runPublish,
  runNarrate,
  runRender,
  runShoot,
  validateScenario,
  loadScenarioYaml,
} from "@scenar/cli/api";
import { projectRoot, resolveInProject } from "./project.js";
import { rememberServer, listServers, stopServer } from "./serve-registry.js";

/** A successful text result. */
function text(body: string): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text", text: body }] };
}

/** An error result (sets isError so the client renders it as a failure). */
function fail(message: string): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
} {
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

/** Run an async op, formatting any throw as a tool error rather than crashing. */
async function guard(
  op: () => Promise<{ content: Array<{ type: "text"; text: string }>; isError?: true }>,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: true }> {
  try {
    return await op();
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

/** Register every Scenar tool on the server. */
export function registerTools(server: McpServer): void {
  registerInstall(server);
  registerValidate(server);
  registerNarrate(server);
  registerPack(server);
  registerShoot(server);
  registerServe(server);
  registerStopServe(server);
  registerPublish(server);
  registerRender(server);
}

function registerInstall(server: McpServer): void {
  server.registerTool(
    "scenar_install",
    {
      title: "Bootstrap a Scenar demos project",
      description:
        "Bootstrap a Scenar demos project in one step: scaffold a package.json and a " +
        "runnable starter tour under tours/example-tour/ if the directory is empty, add " +
        "the given component packages as ordinary dependencies, and run the package " +
        "manager. Run this first, before authoring a scenario. Re-run any time — existing " +
        "files are never overwritten, so authored tours are preserved. Component specs are " +
        "resolver-agnostic: a registry version (@stigmer/react@1.2.0), workspace:*, " +
        "file:../pkg, or a git URL all work. After bootstrapping, edit " +
        "tours/example-tour/index.tsx to render your real components and wire any data " +
        "they fetch in tours/example-tour/.scenar/providers.tsx.",
      inputSchema: {
        packages: z
          .array(z.string())
          .optional()
          .describe("component packages to add as dependencies (e.g. @stigmer/react)"),
        dir: z.string().optional().describe("project directory (default: project root)"),
        skipInstall: z
          .boolean()
          .optional()
          .describe("scaffold and record dependencies but skip the package-manager install"),
        packageManager: z
          .enum(["npm", "yarn", "pnpm"])
          .optional()
          .describe("force a package manager instead of auto-detecting"),
      },
    },
    async ({ packages, dir, skipInstall, packageManager }) =>
      guard(async () => {
        const cwd = dir ? resolveInProject(dir) : projectRoot();

        const installResult = runInstall({
          cwd,
          packages: packages ?? [],
          onLog: () => {}, // structured result below drives the report (no ANSI noise)
          skipInstall,
          packageManager,
        });

        const rel = (p: string) => relative(projectRoot(), p) || ".";
        const lines: Array<string | null> = [];
        if (installResult.scaffolded) {
          lines.push(`Scaffolded a new Scenar demos project in ${rel(cwd)}/:`);
          for (const f of installResult.scaffoldCreated) lines.push(`  + ${f}`);
          lines.push(``);
        }
        if (installResult.added.length > 0) {
          lines.push(`Dependencies added: ${installResult.added.map((s) => s.name).join(", ")}`);
        }
        lines.push(
          installResult.installRan
            ? `Installed with ${installResult.packageManager}${installResult.workspaceRoot ? " (at the workspace root)" : ""}.`
            : `Install skipped — run ${installResult.packageManager} before packing.`,
        );
        lines.push(``);
        lines.push(
          `Next: scenar_pack tours/example-tour to preview, then edit its index.tsx to ` +
            `render your real components and wire any data they fetch in ` +
            `tours/example-tour/.scenar/providers.tsx.`,
        );
        return text(lines.filter((l): l is string => l !== null).join("\n"));
      }),
  );
}

function registerValidate(server: McpServer): void {
  server.registerTool(
    "scenar_validate",
    {
      title: "Validate a scenario YAML",
      description: "Validate a scenario YAML file against the proto schema. Returns the errors, if any.",
      inputSchema: {
        file: z.string().describe("path to a scenario YAML file"),
      },
    },
    async ({ file }) =>
      guard(async () => {
        const scenario = await loadScenarioYaml(resolveInProject(file));
        const result = validateScenario(scenario);
        if (result.valid) {
          return text(`Valid: ${file}`);
        }
        const lines = [
          `Invalid: ${file} (${result.errors.length} error(s))`,
          ...result.errors.map((e) => `  • ${e.path}: ${e.reason}`),
        ];
        return text(lines.join("\n"));
      }),
  );
}

function registerNarrate(server: McpServer): void {
  server.registerTool(
    "scenar_narrate",
    {
      title: "Generate narration audio",
      description:
        "Synthesize per-step narration audio (TTS) for a scenario file or a directory " +
        "of scenarios. Writes a narration/ folder with a manifest and mp3 clips. " +
        "Requires the chosen TTS provider's optional dependency to be installed.",
      inputSchema: {
        target: z.string().describe("scenario file (.yaml/.ts) or a directory of scenarios"),
        tts: z.enum(["echogarden", "edge-tts", "openai"]).optional().describe("TTS provider (default: echogarden)"),
        out: z.string().optional().describe("output directory for audio"),
        voice: z.string().optional().describe("voice name (provider-specific)"),
        baseUrl: z.string().optional().describe("URL path prefix for src fields in the manifest"),
      },
    },
    async ({ target, tts, out, voice, baseUrl }) =>
      guard(async () => {
        const result = await runNarrate({
          target: resolveInProject(target),
          tts,
          out: out ? resolveInProject(out) : undefined,
          voice,
          baseUrl,
        });
        const lines = [
          `Narrated (${result.mode}): ${result.totalGenerated} generated, ${result.totalCached} cached, ${result.totalSkipped} skipped`,
          ...result.scenarios.map(
            (s) => `  ${s.id}: ${s.skipped ? "no narration" : `${s.generated} generated, ${s.cached} cached`}`,
          ),
          ...result.errors.map((e) => `  ✗ ${e.id}: ${e.message}`),
        ];
        return result.errors.length > 0 ? fail(lines.join("\n")) : text(lines.join("\n"));
      }),
  );
}

function registerPack(server: McpServer): void {
  server.registerTool(
    "scenar_pack",
    {
      title: "Pack a scenario into a static embed",
      description:
        "Bundle a scenario directory (steps.ts + index.tsx exporting renderStep) into a " +
        "self-contained static embed with Vite. Output defaults to ./<id>-bundle. " +
        "The bundle is ready for scenar_serve or scenar_publish.",
      inputSchema: {
        scenarioDir: z.string().describe("scenario directory (must contain steps.ts)"),
        outDir: z.string().optional().describe("output directory for the bundle"),
        width: z.number().int().positive().optional().describe("canonical viewport width in px (default 896)"),
        shellHeight: z.number().int().positive().optional().describe("shell height in px (default 480)"),
      },
    },
    async ({ scenarioDir, outDir, width, shellHeight }) =>
      guard(async () => {
        const result = await runPack({
          scenarioDir: resolveInProject(scenarioDir),
          outDir: outDir ? resolveInProject(outDir) : undefined,
          width,
          shellHeight,
        });
        const lines = [
          `Packed ${result.manifest.files.length} file(s), ${formatBytes(result.totalBytes)}`,
          `  output: ${result.outDir}`,
          `  render: ${result.renderFilePath}`,
          `  providers: ${result.providersPath ?? "none"}`,
          `  narration: ${result.hasNarration ? "yes" : "none"}`,
          ``,
          `Next: scenar_serve to preview, or scenar_publish for a public URL.`,
        ];
        return text(lines.join("\n"));
      }),
  );
}

function registerServe(server: McpServer): void {
  server.registerTool(
    "scenar_serve",
    {
      title: "Serve a packed bundle locally",
      description:
        "Start a local static server for a packed bundle and return its URL plus an " +
        "<iframe> embed snippet. The server stays running across tool calls; stop it " +
        "with scenar_stop_serve.",
      inputSchema: {
        bundleDir: z.string().describe("a packed bundle directory (from scenar_pack)"),
        port: z.number().int().min(0).max(65535).optional().describe("port (default 4173; 0 = pick a free one)"),
        host: z.string().optional().describe("host/interface to bind (default localhost)"),
      },
    },
    async ({ bundleDir, port, host }) =>
      guard(async () => {
        const result = await runServe({
          bundleDir: resolveInProject(bundleDir),
          port: port ?? 4173,
          host,
        });
        rememberServer(result.handle);
        return text([`Serving at ${result.url}`, ``, `Embed snippet:`, result.snippet].join("\n"));
      }),
  );
}

function registerStopServe(server: McpServer): void {
  server.registerTool(
    "scenar_stop_serve",
    {
      title: "Stop local preview server(s)",
      description:
        "Stop a preview server started by scenar_serve. Pass a url to stop one, or " +
        "omit it to list the running servers.",
      inputSchema: {
        url: z.string().optional().describe("the server URL to stop (omit to list running servers)"),
      },
    },
    async ({ url }) =>
      guard(async () => {
        if (!url) {
          const running = listServers();
          return text(running.length > 0 ? `Running:\n${running.map((u) => `  ${u}`).join("\n")}` : "No servers running.");
        }
        const stopped = await stopServer(url);
        return text(stopped ? `Stopped ${url}` : `No server running at ${url}`);
      }),
  );
}

function registerPublish(server: McpServer): void {
  server.registerTool(
    "scenar_publish",
    {
      title: "Publish a bundle to GitHub Pages",
      description:
        "Publish a packed bundle to GitHub Pages and return its public URL. Many tours " +
        "share one repo: repo defaults to `scenar-embeds` and path to the scenario slug, " +
        "so the embed serves at https://<you>.github.io/scenar-embeds/<slug>/ and " +
        "re-publishing one tour preserves the others. Pass path '/' to publish at the " +
        "repo root. Requires the GitHub CLI (gh) installed and authenticated.",
      inputSchema: {
        bundleDir: z.string().describe("a packed bundle directory (from scenar_pack)"),
        repo: z.string().optional().describe("repository name (default: scenar-embeds)"),
        path: z.string().optional().describe("subdirectory within the repo (default: the scenario slug; '/' for the root)"),
        org: z.string().optional().describe("GitHub org (default: the authenticated user)"),
        private: z.boolean().optional().describe("create a private repo (GitHub Pages needs a paid plan)"),
        message: z.string().optional().describe("commit message for the published snapshot"),
      },
    },
    async ({ bundleDir, repo, path, org, private: isPrivate, message }) =>
      guard(async () => {
        const { result, snippet } = await runPublish({
          bundleDir: resolveInProject(bundleDir),
          repo,
          path,
          org,
          private: isPrivate,
          message,
        });
        const location = result.path ? `${result.owner}/${result.repo}/${result.path}` : `${result.owner}/${result.repo}`;
        const lines = [
          `${result.created ? "Created" : "Updated"} ${location}`,
          `  public URL: ${result.pagesUrl}`,
          `  repo: ${result.repoUrl}`,
          `  (Pages builds asynchronously; live in ~1 minute on first publish)`,
          ``,
          `Embed snippet:`,
          snippet,
        ];
        return text(lines.join("\n"));
      }),
  );
}

function registerShoot(server: McpServer): void {
  server.registerTool(
    "scenar_shoot",
    {
      title: "Render a bundle's declared shots to stills",
      description:
        "Capture a packed bundle's `shot`-named steps as still images (light + dark) " +
        "into <bundle>/stills/, walking the timeline deterministically, then rebuild " +
        "the pack manifest so deploys ship the stills. Requires the Playwright " +
        "optional peer (npm i -D playwright && npx playwright install chromium).",
      inputSchema: {
        bundleDir: z.string().describe("a packed bundle directory (from scenar_pack)"),
        theme: z
          .enum(["light", "dark", "both"])
          .optional()
          .describe("themes to capture (default both)"),
        verify: z
          .boolean()
          .optional()
          .describe("capture twice in fresh sessions and fail unless byte-identical"),
      },
    },
    async ({ bundleDir, theme, verify }) =>
      guard(async () => {
        const result = await runShoot({
          bundleDir: resolveInProject(bundleDir),
          themes: theme === "light" || theme === "dark" ? [theme] : undefined,
          verify: verify ?? false,
        });
        if (result.shots.length === 0) {
          return text(
            `No shots declared in ${result.scenarioId} — nothing captured. ` +
              `Name a capture point by setting shot: "<kebab-name>" on a step.`,
          );
        }
        return text(
          [
            `Shot ${result.files.length} stills for ${result.scenarioId}` +
              `${result.verified ? " (byte-identical across sessions)" : ""}:`,
            ...result.files.map((file) => `  ${file}`),
          ].join("\n"),
        );
      }),
  );
}

function registerRender(server: McpServer): void {
  server.registerTool(
    "scenar_render",
    {
      title: "Render a scenario to MP4",
      description:
        "Render a scenario directory to an MP4 video via Remotion (same source as the " +
        "embed). Requires the Remotion peer dependencies to be installed.",
      inputSchema: {
        scenarioDir: z.string().describe("scenario directory (must contain steps.ts)"),
        out: z.string().optional().describe("output .mp4 path or directory"),
        fps: z.number().int().positive().optional().describe("frames per second (default 30)"),
        width: z.number().int().positive().optional().describe("video width in px (default 1920)"),
        height: z.number().int().positive().optional().describe("video height in px (default 1080)"),
      },
    },
    async ({ scenarioDir, out, fps, width, height }) =>
      guard(async () => {
        const result = await runRender({
          scenarioDir: resolveInProject(scenarioDir),
          out: out ? resolveInProject(out) : undefined,
          fps,
          width,
          height,
        });
        return text(
          [
            `Rendered ${result.scenarioId} → ${result.outputPath}`,
            `  ${result.width}x${result.height} @ ${result.fps}fps, ${result.steps} step(s)`,
          ].join("\n"),
        );
      }),
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}
