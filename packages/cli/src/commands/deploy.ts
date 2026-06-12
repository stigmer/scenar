import { resolve, join } from "node:path";
import { readFile, stat } from "node:fs/promises";
import { Command } from "commander";
import type { PackManifest } from "../pack/pack-manifest.js";
import { PACK_MANIFEST_FILE } from "../pack/pack-manifest.js";
import { createBackendClients } from "../deploy/client.js";
import { putFile } from "../deploy/upload.js";
import { runDeployFlow, localViewUrl, type DeployFlowDeps } from "../deploy/deploy-flow.js";

/** Default local backend (gRPC). Local dev shifts off 8080 to avoid colliding with stigmer-service. */
const DEFAULT_BACKEND = "http://localhost:8090";

/** Slug rule from ApiResourceMetadata: lowercase, hyphens, start letter, end alphanumeric. */
const SLUG_PATTERN = /^[a-z][a-z0-9-]*[a-z0-9]$/;

interface DeployOptions {
  backend?: string;
  org?: string;
  slug?: string;
  name?: string;
}

export function registerDeployCommand(program: Command): void {
  program
    .command("deploy")
    .description(
      "Deploy a packed bundle to Scenar Cloud and print its embed URL.\n\n" +
        "Takes a bundle directory produced by `scenar pack` (containing\n" +
        "pack-manifest.json). It ensures the parent scenario exists, opens a\n" +
        "two-phase upload session, uploads every file directly to object\n" +
        "storage via presigned URLs, completes the session, and prints the\n" +
        "deploy's embed URL.\n\n" +
        "Backend defaults to http://localhost:8090 (override with --backend or\n" +
        "SCENAR_BACKEND). The owning org is required (--org or SCENAR_ORG).",
    )
    .argument("<bundleDir>", "path to a packed bundle directory (from scenar pack)")
    .option("--backend <url>", "backend gRPC endpoint (default: $SCENAR_BACKEND or http://localhost:8090)")
    .option("--org <org>", "owning organization (default: $SCENAR_ORG)")
    .option("--slug <slug>", "scenario slug (default: the packed scenario id)")
    .option("--name <name>", "scenario display name (default: the slug)")
    .action(async (bundleDir: string, options: DeployOptions) => {
      const resolvedDir = resolve(bundleDir);

      try {
        const info = await stat(resolvedDir).catch(() => null);
        if (!info || !info.isDirectory()) {
          throw new Error(
            `${bundleDir} is not a directory. Pass a bundle produced by \`scenar pack\`.`,
          );
        }

        const manifest = await readPackManifest(resolvedDir);

        const backend = options.backend ?? process.env.SCENAR_BACKEND ?? DEFAULT_BACKEND;
        const org = options.org ?? process.env.SCENAR_ORG;
        if (!org) {
          throw new Error(
            "an owning org is required: pass --org <org> or set SCENAR_ORG.",
          );
        }
        const slug = options.slug ?? manifest.scenarioId;
        if (!SLUG_PATTERN.test(slug)) {
          throw new Error(
            `invalid scenario slug "${slug}". Slugs are lowercase letters, digits,\n` +
              "and hyphens, starting with a letter and ending alphanumeric. Pass --slug to override.",
          );
        }
        const name = options.name ?? slug;

        process.stderr.write(`Bundle:   ${resolvedDir}\n`);
        process.stderr.write(`Backend:  ${backend}\n`);
        process.stderr.write(`Org:      ${org}\n`);
        process.stderr.write(`Scenario: ${slug}\n\n`);

        const clients = createBackendClients(backend);
        const deps = makeDeps(clients, resolvedDir);

        const { deployId, embedUrl } = await runDeployFlow(deps, { manifest, org, slug, name });

        process.stderr.write(`\n\x1b[32m✓\x1b[0m Deployed ${deployId}\n`);
        process.stdout.write(`${embedUrl}\n`);

        const localUrl = localViewUrl(embedUrl);
        if (localUrl !== embedUrl) {
          process.stderr.write(`  Local view: ${localUrl}\n`);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        process.stderr.write(`\x1b[31mError:\x1b[0m ${msg}\n`);
        process.exitCode = 1;
      }
    });
}

/** Build the flow dependencies from real Connect clients + the bundle on disk. */
function makeDeps(
  clients: ReturnType<typeof createBackendClients>,
  bundleDir: string,
): DeployFlowDeps {
  return {
    async applyScenario({ org, slug, name }) {
      // Idempotent upsert by (org, slug). The spec is a minimal valid placeholder
      // (one step) — the embed plays from the packed JS, so the Scenario resource
      // serves as the authorization parent and publication anchor, not the
      // serving source. A richer spec projection is a deliberate follow-up.
      const scenario = await clients.scenario.apply({
        apiVersion: "scenario.scenar.ai/v1",
        kind: "Scenario",
        metadata: { org, slug, name },
        spec: { steps: [{ view: "scenario", delayMs: 0 }] },
      });
      const id = scenario.metadata?.id;
      if (!id) {
        throw new Error("scenario apply returned no metadata.id");
      }
      return id;
    },
    async createSession(scenarioId, files) {
      const response = await clients.deploy.createDeployUploadSession({ scenarioId, files });
      return {
        deployId: response.deployId,
        uploadTargets: response.uploadTargets.map((target) => ({
          relativePath: target.relativePath,
          presignedPutUrl: target.presignedPutUrl,
          requiredHeaders: target.requiredHeaders,
        })),
      };
    },
    readBundleFile(relativePath) {
      return readFile(join(bundleDir, ...relativePath.split("/")));
    },
    uploadFile(target, bytes) {
      return putFile(target.presignedPutUrl, target.requiredHeaders, bytes);
    },
    async completeSession(deployId) {
      const deploy = await clients.deploy.completeDeployUploadSession({ deployId });
      const embedUrl = deploy.status?.embedUrl;
      if (!embedUrl) {
        throw new Error("deploy completed but returned no embed_url");
      }
      return embedUrl;
    },
    log(message) {
      process.stderr.write(`${message}\n`);
    },
  };
}

async function readPackManifest(bundleDir: string): Promise<PackManifest> {
  const manifestPath = join(bundleDir, PACK_MANIFEST_FILE);
  let raw: string;
  try {
    raw = await readFile(manifestPath, "utf-8");
  } catch {
    throw new Error(
      `no ${PACK_MANIFEST_FILE} in ${bundleDir}. Run \`scenar pack\` to produce a bundle first.`,
    );
  }
  const parsed = JSON.parse(raw) as PackManifest;
  if (!parsed.scenarioId || !Array.isArray(parsed.files) || parsed.files.length === 0) {
    throw new Error(`${PACK_MANIFEST_FILE} is malformed or lists no files.`);
  }
  return parsed;
}
