/**
 * Minimal HeyGen API client for `scenar presenter` — deliberately an
 * internal module of the CLI, not published API. Shaped so a second
 * avatar provider could slot in behind the same function signatures,
 * but the interface is not exported until a second provider is a
 * concrete need (the TTS-provider precedent).
 *
 * Endpoints and response fields follow the live Gate 0 transcript:
 * `POST /v3/assets` (multipart) → `data.asset_id`;
 * `POST /v3/videos` (`type: "avatar"`, `audio_asset_id`) →
 * `data.video_id`; `GET /v3/videos/{id}` → `data.status`
 * (`completed`/`failed`), `data.video_url`, `data.failure_message`.
 *
 * BYO key, no Scenar-side proxying — identical to the TTS providers.
 * Native fetch, no new runtime dependencies.
 */

const HEYGEN_BASE_URL = "https://api.heygen.com";

/** Engine flag values → HeyGen's API vocabulary. */
export const HEYGEN_ENGINE_TYPES = {
  iii: "avatar_iii",
  iv: "avatar_iv",
} as const;

export type HeygenEngineFlag = keyof typeof HEYGEN_ENGINE_TYPES;

/**
 * Indicative $/minute of narration audio per engine, from the project
 * cost analysis. The estimate the cost gate prints is indicative —
 * HeyGen bills credits, not dollars.
 */
export const HEYGEN_RATE_PER_MIN: Record<HeygenEngineFlag, number> = {
  iii: 1.0,
  iv: 4.0,
};

const MAX_ATTEMPTS_ON_429 = 3;
const DEFAULT_RETRY_AFTER_S = 30;

export interface HeygenRequestContext {
  readonly apiKey: string;
  /** Injectable for tests; defaults to a real timer. */
  readonly sleep?: (ms: number) => Promise<void>;
  /** Rate-limit feedback sink (stderr line per retry). */
  readonly onRetry?: (message: string) => void;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Run a HeyGen request, honoring 429 rate limits: wait `Retry-After`
 * (default 30 s) and retry the same call, up to 3 attempts total.
 */
async function heygenFetch(
  ctx: HeygenRequestContext,
  path: string,
  init: RequestInit,
): Promise<Response> {
  const sleep = ctx.sleep ?? realSleep;
  let response: Response;
  for (let attempt = 1; ; attempt++) {
    response = await fetch(`${HEYGEN_BASE_URL}${path}`, {
      ...init,
      headers: { "x-api-key": ctx.apiKey, ...(init.headers ?? {}) },
    });
    if (response.status !== 429 || attempt >= MAX_ATTEMPTS_ON_429) return response;

    const retryAfterS =
      Number(response.headers.get("retry-after")) || DEFAULT_RETRY_AFTER_S;
    ctx.onRetry?.(
      `rate-limited, retrying in ${retryAfterS}s (${attempt}/${MAX_ATTEMPTS_ON_429})`,
    );
    await sleep(retryAfterS * 1000);
  }
}

async function readBody(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function apiError(operation: string, response: Response, body: unknown): Error {
  return new Error(
    `HeyGen ${operation} failed (${response.status}): ${JSON.stringify(body)}`,
  );
}

/** Upload one narration MP3 as a HeyGen asset (free). Returns the asset id. */
export async function uploadAudioAsset(
  ctx: HeygenRequestContext,
  audio: Buffer,
  filename: string,
): Promise<string> {
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(audio)], { type: "audio/mpeg" }),
    filename,
  );
  const response = await heygenFetch(ctx, "/v3/assets", {
    method: "POST",
    body: form,
  });
  const body = await readBody(response);
  if (!response.ok) throw apiError("asset upload", response, body);
  const assetId = (body["data"] as Record<string, unknown> | undefined)?.["asset_id"];
  if (typeof assetId !== "string" || assetId.length === 0) {
    throw new Error(`HeyGen asset upload returned no asset_id: ${JSON.stringify(body)}`);
  }
  return assetId;
}

export interface CreateAvatarVideoInput {
  readonly avatarId: string;
  readonly audioAssetId: string;
  readonly engine: HeygenEngineFlag;
  readonly resolution: string;
  /**
   * Deterministic title (`scenar <scenarioId> step-<N> <hash8>`) so any
   * duplicate generation is identifiable in the HeyGen dashboard.
   */
  readonly title: string;
}

/** Create one avatar video lip-synced to the uploaded audio. Returns the video id. */
export async function createAvatarVideo(
  ctx: HeygenRequestContext,
  input: CreateAvatarVideoInput,
): Promise<string> {
  const response = await heygenFetch(ctx, "/v3/videos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "avatar",
      avatar_id: input.avatarId,
      audio_asset_id: input.audioAssetId,
      engine: { type: HEYGEN_ENGINE_TYPES[input.engine] },
      output_format: "mp4",
      aspect_ratio: "auto",
      resolution: input.resolution,
      title: input.title,
    }),
  });
  const body = await readBody(response);
  if (!response.ok) throw apiError("video create", response, body);
  const videoId = (body["data"] as Record<string, unknown> | undefined)?.["video_id"];
  if (typeof videoId !== "string" || videoId.length === 0) {
    throw new Error(`HeyGen video create returned no video_id: ${JSON.stringify(body)}`);
  }
  return videoId;
}

export interface PollOutcome {
  readonly status: "completed" | "failed" | "timeout";
  readonly videoUrl?: string;
  readonly failureMessage?: string;
}

export interface PollOptions {
  readonly intervalMs: number;
  readonly timeoutMs: number;
  /** Elapsed-time feedback per tick (drives the progress line). */
  readonly onTick?: (elapsedMs: number) => void;
}

/**
 * Poll a generation to completion. Polling is read-only, so transient
 * network errors retry on the next tick inside the step timeout.
 */
export async function pollVideo(
  ctx: HeygenRequestContext,
  videoId: string,
  options: PollOptions,
): Promise<PollOutcome> {
  const sleep = ctx.sleep ?? realSleep;
  const startedAt = Date.now();

  while (Date.now() - startedAt < options.timeoutMs) {
    await sleep(options.intervalMs);
    options.onTick?.(Date.now() - startedAt);

    let body: Record<string, unknown>;
    try {
      const response = await heygenFetch(ctx, `/v3/videos/${videoId}`, { method: "GET" });
      body = await readBody(response);
      if (!response.ok) continue;
    } catch {
      continue;
    }

    const data = (body["data"] ?? {}) as Record<string, unknown>;
    const status = data["status"];
    if (status === "completed") {
      return {
        status: "completed",
        videoUrl: typeof data["video_url"] === "string" ? data["video_url"] : undefined,
      };
    }
    if (status === "failed") {
      return {
        status: "failed",
        failureMessage:
          typeof data["failure_message"] === "string"
            ? data["failure_message"]
            : JSON.stringify(data["failure_message"] ?? "unknown failure"),
      };
    }
  }

  return { status: "timeout" };
}

/** Download a completed clip. Returns the raw bytes. */
export async function downloadVideo(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HeyGen clip download failed (${response.status}) for ${url}`);
  }
  return Buffer.from(await response.arrayBuffer());
}
