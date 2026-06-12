import type { PackManifest } from "../pack/pack-manifest.js";

/**
 * One presigned upload target as the backend returns it. Mirrors the relevant
 * fields of ai.scenar.deploy.v1.FileUploadTarget.
 */
export interface UploadTarget {
  readonly relativePath: string;
  readonly presignedPutUrl: string;
  /**
   * Headers that MUST be replayed verbatim on the PUT for the signature to
   * validate (Content-Type + x-amz-checksum-sha256). The backend deliberately
   * omits host/content-length, which the HTTP layer owns.
   */
  readonly requiredHeaders: Record<string, string>;
}

/** A file declared to the upload session — the init shape for DeclaredFile. */
export interface DeclaredFileInit {
  readonly relativePath: string;
  /** Lowercase-hex SHA-256 (the proto + presign both bind this exact form). */
  readonly sha256: string;
  /** int64 on the wire — carried as bigint to avoid precision loss. */
  readonly sizeBytes: bigint;
  readonly contentType: string;
}

/** Identity for the ensure-scenario (apply) step. */
export interface ScenarioApplyInput {
  readonly org: string;
  readonly slug: string;
  readonly name: string;
}

/**
 * The side-effecting operations the flow depends on, injected so the ordering
 * and payloads can be unit-tested against fakes without a live backend.
 */
export interface DeployFlowDeps {
  /** Idempotently ensure the parent scenario exists; returns its metadata.id. */
  applyScenario(input: ScenarioApplyInput): Promise<string>;
  /** Open the upload session; returns the deploy id + per-file targets. */
  createSession(
    scenarioId: string,
    files: DeclaredFileInit[],
  ): Promise<{ deployId: string; uploadTargets: UploadTarget[] }>;
  /** Read a bundle file's bytes by its relative path. */
  readBundleFile(relativePath: string): Promise<Uint8Array>;
  /** PUT one file's bytes to its presigned target, replaying required headers. */
  uploadFile(target: UploadTarget, bytes: Uint8Array): Promise<void>;
  /** Finalize the session; returns the published deploy's embed_url. */
  completeSession(deployId: string): Promise<string>;
  /** Progress sink (stderr in the command; captured in tests). */
  log(message: string): void;
}

/** Map a pack manifest to the deploy session's declared-file inventory. */
export function toDeclaredFiles(manifest: PackManifest): DeclaredFileInit[] {
  return manifest.files.map((file) => ({
    relativePath: file.path,
    sha256: file.sha256,
    sizeBytes: BigInt(file.sizeBytes),
    contentType: file.contentType,
  }));
}

/**
 * Drive the deploy: ensure the parent scenario, open the upload session, PUT
 * every file to its presigned target (in the order the backend returned them,
 * replaying required headers verbatim), then complete and return the embed URL.
 *
 * The ensure-then-deploy ordering is load-bearing: createDeployUploadSession
 * authorizes against and inherits its org from an existing scenario, so the
 * scenario must exist first.
 */
export async function runDeployFlow(
  deps: DeployFlowDeps,
  opts: { manifest: PackManifest; org: string; slug: string; name: string },
): Promise<{ deployId: string; embedUrl: string }> {
  deps.log(`Ensuring scenario ${opts.org}/${opts.slug}...`);
  const scenarioId = await deps.applyScenario({ org: opts.org, slug: opts.slug, name: opts.name });

  const files = toDeclaredFiles(opts.manifest);
  deps.log(`Creating deploy session (${files.length} files)...`);
  const { deployId, uploadTargets } = await deps.createSession(scenarioId, files);

  for (const target of uploadTargets) {
    const bytes = await deps.readBundleFile(target.relativePath);
    deps.log(`Uploading ${target.relativePath} (${bytes.byteLength} bytes)...`);
    await deps.uploadFile(target, bytes);
  }

  deps.log("Completing deploy...");
  const embedUrl = await deps.completeSession(deployId);
  return { deployId, embedUrl };
}

/**
 * Derive a locally-viewable URL from a deploy's embed_url. The backend always
 * emits https://, but the local edge (wrangler dev) serves over http on
 * *.localhost; for those hosts we downgrade the scheme so the link is clickable.
 */
export function localViewUrl(embedUrl: string): string {
  try {
    const url = new URL(embedUrl);
    const isLocal = url.hostname === "localhost" || url.hostname.endsWith(".localhost");
    if (isLocal && url.protocol === "https:") {
      url.protocol = "http:";
      return url.toString();
    }
  } catch {
    // Not a parseable URL — return as-is.
  }
  return embedUrl;
}
