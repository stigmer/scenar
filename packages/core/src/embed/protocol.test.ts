import { describe, expect, it } from "vitest";
import {
  SCENAR_EMBED_PROTOCOL_VERSION,
  SCENAR_EMBED_SOURCE,
  frameEmbedCommand,
  frameEmbedEvent,
  parseEmbedCommand,
  parseEmbedEvent,
} from "./protocol.js";

describe("frameEmbedEvent / frameEmbedCommand", () => {
  it("stamps the source and version envelope", () => {
    const msg = frameEmbedEvent({ type: "started" });
    expect(msg).toEqual({
      source: SCENAR_EMBED_SOURCE,
      v: SCENAR_EMBED_PROTOCOL_VERSION,
      type: "started",
    });
  });

  it("preserves the command payload fields", () => {
    const msg = frameEmbedCommand({ type: "seek", timeMs: 1500 });
    expect(msg).toMatchObject({ source: SCENAR_EMBED_SOURCE, type: "seek", timeMs: 1500 });
  });
});

describe("parseEmbedCommand", () => {
  const wrap = (payload: Record<string, unknown>) => ({
    source: SCENAR_EMBED_SOURCE,
    v: SCENAR_EMBED_PROTOCOL_VERSION,
    ...payload,
  });

  it("accepts well-formed parameterless commands", () => {
    for (const type of ["play", "pause", "prefetch", "destroy"] as const) {
      expect(parseEmbedCommand(wrap({ type }))).toEqual({ type });
    }
  });

  it("accepts seek with a finite timeMs", () => {
    expect(parseEmbedCommand(wrap({ type: "seek", timeMs: 250 }))).toEqual({
      type: "seek",
      timeMs: 250,
    });
  });

  it("accepts setMuted with a boolean and setVolume with a number", () => {
    expect(parseEmbedCommand(wrap({ type: "setMuted", muted: true }))).toEqual({
      type: "setMuted",
      muted: true,
    });
    expect(parseEmbedCommand(wrap({ type: "setVolume", volume: 0.4 }))).toEqual({
      type: "setVolume",
      volume: 0.4,
    });
  });

  it("accepts setHostScale with a positive finite scale", () => {
    expect(parseEmbedCommand(wrap({ type: "setHostScale", scale: 0.7 }))).toEqual({
      type: "setHostScale",
      scale: 0.7,
    });
  });

  it("rejects setHostScale with a missing, non-finite, or non-positive scale", () => {
    expect(parseEmbedCommand(wrap({ type: "setHostScale" }))).toBeNull();
    expect(parseEmbedCommand(wrap({ type: "setHostScale", scale: "big" }))).toBeNull();
    expect(parseEmbedCommand(wrap({ type: "setHostScale", scale: Number.NaN }))).toBeNull();
    expect(parseEmbedCommand(wrap({ type: "setHostScale", scale: 0 }))).toBeNull();
    expect(parseEmbedCommand(wrap({ type: "setHostScale", scale: -1 }))).toBeNull();
  });

  it("rejects a foreign source", () => {
    expect(parseEmbedCommand({ source: "other-widget", v: 1, type: "play" })).toBeNull();
  });

  it("rejects a mismatched protocol version", () => {
    expect(parseEmbedCommand({ source: SCENAR_EMBED_SOURCE, v: 999, type: "play" })).toBeNull();
  });

  it("rejects an unknown command type", () => {
    expect(parseEmbedCommand(wrap({ type: "explode" }))).toBeNull();
  });

  it("rejects commands missing or mistyping required fields", () => {
    expect(parseEmbedCommand(wrap({ type: "seek" }))).toBeNull();
    expect(parseEmbedCommand(wrap({ type: "seek", timeMs: "soon" }))).toBeNull();
    expect(parseEmbedCommand(wrap({ type: "seek", timeMs: Number.NaN }))).toBeNull();
    expect(parseEmbedCommand(wrap({ type: "setMuted", muted: "yes" }))).toBeNull();
    expect(parseEmbedCommand(wrap({ type: "setVolume" }))).toBeNull();
  });

  it("rejects non-object inputs", () => {
    expect(parseEmbedCommand(null)).toBeNull();
    expect(parseEmbedCommand("play")).toBeNull();
    expect(parseEmbedCommand(42)).toBeNull();
  });
});

describe("parseEmbedEvent", () => {
  const wrap = (payload: Record<string, unknown>) => ({
    source: SCENAR_EMBED_SOURCE,
    v: SCENAR_EMBED_PROTOCOL_VERSION,
    ...payload,
  });

  it("round-trips an event through frame + parse", () => {
    const framed = frameEmbedEvent({ type: "stepchange", stepIndex: 2, totalSteps: 5 });
    expect(parseEmbedEvent(framed)).toEqual({ type: "stepchange", stepIndex: 2, totalSteps: 5 });
  });

  it("validates the ready payload", () => {
    expect(parseEmbedEvent(wrap({ type: "ready", totalSteps: 3, hasNarration: true }))).toEqual({
      type: "ready",
      totalSteps: 3,
      hasNarration: true,
    });
    expect(parseEmbedEvent(wrap({ type: "ready", totalSteps: 3 }))).toBeNull();
  });

  it("accepts a ready payload carrying a well-formed canonical viewport", () => {
    expect(
      parseEmbedEvent(
        wrap({
          type: "ready",
          totalSteps: 3,
          hasNarration: false,
          viewport: { widthPx: 1440, heightPx: 900 },
        }),
      ),
    ).toEqual({
      type: "ready",
      totalSteps: 3,
      hasNarration: false,
      viewport: { widthPx: 1440, heightPx: 900 },
    });
  });

  it("still accepts a ready payload without a viewport (pre-viewport bundles)", () => {
    const parsed = parseEmbedEvent(wrap({ type: "ready", totalSteps: 3, hasNarration: false }));
    expect(parsed).toEqual({ type: "ready", totalSteps: 3, hasNarration: false });
    // The field must be genuinely absent, not present-and-undefined — hosts
    // branch on `event.viewport` to decide iframe-as-screen adoption.
    expect(parsed && "viewport" in parsed).toBe(false);
  });

  it("rejects a ready payload whose viewport is malformed", () => {
    const base = { type: "ready", totalSteps: 3, hasNarration: false };
    expect(parseEmbedEvent(wrap({ ...base, viewport: "1440x900" }))).toBeNull();
    expect(parseEmbedEvent(wrap({ ...base, viewport: { widthPx: 1440 } }))).toBeNull();
    expect(
      parseEmbedEvent(wrap({ ...base, viewport: { widthPx: 0, heightPx: 900 } })),
    ).toBeNull();
    expect(
      parseEmbedEvent(wrap({ ...base, viewport: { widthPx: "1440", heightPx: 900 } })),
    ).toBeNull();
  });

  it("rejects foreign source and unknown event types", () => {
    expect(parseEmbedEvent({ source: "x", v: 1, type: "started" })).toBeNull();
    expect(parseEmbedEvent(wrap({ type: "imploded" }))).toBeNull();
  });
});
