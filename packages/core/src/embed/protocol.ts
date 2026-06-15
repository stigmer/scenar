/**
 * The `scenar` embed postMessage protocol (v1).
 *
 * A packed scenario is delivered as a cross-origin iframe. This module is the
 * wire contract between the embedded player and its host page: the events the
 * player emits and the commands the host may send. It is pure (no React, no
 * DOM) and lives in `@scenar/core` so every surface shares one definition — the
 * React embed-side runtime (`useScenarEmbedBridge` in `@scenar/react`), the
 * framework-free host driver ({@link createEmbedHostController}), and any future
 * host loader (`embed.js` / oEmbed).
 *
 * Every message is stamped with a fixed {@link SCENAR_EMBED_SOURCE} and the
 * protocol {@link SCENAR_EMBED_PROTOCOL_VERSION}. Receivers MUST ignore any
 * message whose `source`/`v` do not match — the global `message` channel is
 * shared with the host and every other framed widget on the page.
 */

/** Discriminator stamped on every scenar embed message. */
export const SCENAR_EMBED_SOURCE = "scenar-embed";

/** Protocol version. Bump only on a breaking change to the message shapes. */
export const SCENAR_EMBED_PROTOCOL_VERSION = 1;

/**
 * Events the embedded player emits to the host (embed -> host).
 *
 * - `ready` — the player has mounted; carries scenario shape the host can use
 *   to size or label the frame.
 * - `resize` — the rendered content height changed (dynamic-height hosts).
 * - `started` / `paused` / `completed` — transport state transitions.
 * - `stepchange` — the active step changed.
 * - `progress` — fine-grained playback position (throttled by the emitter).
 * - `audioBlocked` — the browser blocked narration audio; the host may surface
 *   its own affordance or call `setMuted`.
 * - `error` — an unrecoverable runtime error, with a human-readable message.
 */
export type ScenarEmbedEvent =
  | { readonly type: "ready"; readonly totalSteps: number; readonly hasNarration: boolean }
  | { readonly type: "resize"; readonly widthPx: number; readonly heightPx: number }
  | { readonly type: "started" }
  | { readonly type: "paused" }
  | { readonly type: "stepchange"; readonly stepIndex: number; readonly totalSteps: number }
  | {
      readonly type: "progress";
      readonly stepIndex: number;
      readonly totalSteps: number;
      readonly fraction: number;
    }
  | { readonly type: "completed" }
  | { readonly type: "audioBlocked" }
  | { readonly type: "error"; readonly message: string };

/**
 * Commands the host may send to the embedded player (host -> embed).
 *
 * State-setting commands (`setMuted`, `setVolume`) are idempotent by design so
 * a host never has to track the player's internal state to stay in sync.
 */
export type ScenarEmbedCommand =
  | { readonly type: "play" }
  | { readonly type: "pause" }
  | { readonly type: "seek"; readonly timeMs: number }
  | { readonly type: "setMuted"; readonly muted: boolean }
  | { readonly type: "setVolume"; readonly volume: number }
  | { readonly type: "prefetch" }
  | { readonly type: "destroy" };

/** Envelope fields stamped on every message of either direction. */
interface ScenarEmbedEnvelope {
  readonly source: typeof SCENAR_EMBED_SOURCE;
  readonly v: typeof SCENAR_EMBED_PROTOCOL_VERSION;
}

/** A fully-framed event message as it travels over `postMessage`. */
export type ScenarEmbedEventMessage = ScenarEmbedEvent & ScenarEmbedEnvelope;

/** A fully-framed command message as it travels over `postMessage`. */
export type ScenarEmbedCommandMessage = ScenarEmbedCommand & ScenarEmbedEnvelope;

/** Stamp an event with the source + version envelope, ready to post. */
export function frameEmbedEvent(event: ScenarEmbedEvent): ScenarEmbedEventMessage {
  return { source: SCENAR_EMBED_SOURCE, v: SCENAR_EMBED_PROTOCOL_VERSION, ...event };
}

/** Stamp a command with the source + version envelope, ready to post. */
export function frameEmbedCommand(command: ScenarEmbedCommand): ScenarEmbedCommandMessage {
  return { source: SCENAR_EMBED_SOURCE, v: SCENAR_EMBED_PROTOCOL_VERSION, ...command };
}

function isScenarEnvelope(data: unknown): data is Record<string, unknown> & ScenarEmbedEnvelope {
  if (typeof data !== "object" || data === null) return false;
  const record = data as Record<string, unknown>;
  return (
    record["source"] === SCENAR_EMBED_SOURCE && record["v"] === SCENAR_EMBED_PROTOCOL_VERSION
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Parse an inbound `MessageEvent.data` into a typed command, or return `null`.
 *
 * This is the schema boundary: it rejects anything that is not a well-formed
 * scenar command of the matching version, including unknown command types and
 * commands missing or mistyping their required fields. Origin/source-window
 * checks live in the receiver; this function validates the payload shape only.
 */
export function parseEmbedCommand(data: unknown): ScenarEmbedCommand | null {
  if (!isScenarEnvelope(data)) return null;
  const type = data["type"];
  switch (type) {
    case "play":
    case "pause":
    case "prefetch":
    case "destroy":
      return { type };
    case "seek":
      return isFiniteNumber(data["timeMs"]) ? { type, timeMs: data["timeMs"] } : null;
    case "setMuted":
      return typeof data["muted"] === "boolean" ? { type, muted: data["muted"] } : null;
    case "setVolume":
      return isFiniteNumber(data["volume"]) ? { type, volume: data["volume"] } : null;
    default:
      return null;
  }
}

/**
 * Parse an inbound `MessageEvent.data` into a typed event, or return `null`.
 *
 * The symmetric counterpart to {@link parseEmbedCommand} for host-side code
 * consuming the player's events.
 */
export function parseEmbedEvent(data: unknown): ScenarEmbedEvent | null {
  if (!isScenarEnvelope(data)) return null;
  const type = data["type"];
  switch (type) {
    case "started":
    case "paused":
    case "completed":
    case "audioBlocked":
      return { type };
    case "ready":
      return isFiniteNumber(data["totalSteps"]) && typeof data["hasNarration"] === "boolean"
        ? { type, totalSteps: data["totalSteps"], hasNarration: data["hasNarration"] }
        : null;
    case "resize":
      return isFiniteNumber(data["widthPx"]) && isFiniteNumber(data["heightPx"])
        ? { type, widthPx: data["widthPx"], heightPx: data["heightPx"] }
        : null;
    case "stepchange":
      return isFiniteNumber(data["stepIndex"]) && isFiniteNumber(data["totalSteps"])
        ? { type, stepIndex: data["stepIndex"], totalSteps: data["totalSteps"] }
        : null;
    case "progress":
      return isFiniteNumber(data["stepIndex"]) &&
        isFiniteNumber(data["totalSteps"]) &&
        isFiniteNumber(data["fraction"])
        ? {
            type,
            stepIndex: data["stepIndex"],
            totalSteps: data["totalSteps"],
            fraction: data["fraction"],
          }
        : null;
    case "error":
      return typeof data["message"] === "string" ? { type, message: data["message"] } : null;
    default:
      return null;
  }
}
