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

  it("rejects foreign source and unknown event types", () => {
    expect(parseEmbedEvent({ source: "x", v: 1, type: "started" })).toBeNull();
    expect(parseEmbedEvent(wrap({ type: "imploded" }))).toBeNull();
  });
});
