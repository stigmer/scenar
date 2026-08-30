import { describe, expect, it } from "vitest";
import { InvalidScenarioError } from "../proto/errors.js";
import { mapProtoTitleCards } from "../proto/title-cards-mapper.js";

describe("mapProtoTitleCards", () => {
  it("maps a full config field for field", () => {
    const cards = mapProtoTitleCards(
      {
        intro: {
          title: "Acme Deploy",
          subtitle: "Ship in seconds",
          logoSrc: "./logo.png",
          durationMs: 4000,
        },
        outro: { title: "Try it today", ctaText: "acme.dev/start" },
      },
      "titleCards",
    );

    expect(cards.intro).toEqual({
      title: "Acme Deploy",
      subtitle: "Ship in seconds",
      logoSrc: "./logo.png",
      ctaText: undefined,
      durationMs: 4000,
    });
    expect(cards.outro).toEqual({
      title: "Try it today",
      subtitle: undefined,
      logoSrc: undefined,
      ctaText: "acme.dev/start",
      durationMs: undefined,
    });
  });

  it("maps a config with only one side set", () => {
    const cards = mapProtoTitleCards({ outro: { title: "Bye" } }, "titleCards");
    expect(cards.intro).toBeUndefined();
    expect(cards.outro?.title).toBe("Bye");
  });

  it.each([
    ["intro", { intro: { title: "" } }, /titleCards\.intro\.title.*required/],
    ["outro", { outro: { title: "" } }, /titleCards\.outro\.title.*required/],
  ])("rejects an empty title on the %s card", (_side, proto, message) => {
    expect(() => mapProtoTitleCards(proto, "titleCards")).toThrowError(message);
    expect(() => mapProtoTitleCards(proto, "titleCards")).toThrowError(InvalidScenarioError);
  });

  it.each([
    ["subtitle", { intro: { title: "T", subtitle: "" } }, /subtitle.*non-empty/],
    ["logoSrc", { intro: { title: "T", logoSrc: "" } }, /logoSrc.*non-empty/],
    ["ctaText", { intro: { title: "T", ctaText: "" } }, /ctaText.*non-empty/],
  ])("rejects an empty %s when present", (_field, proto, message) => {
    expect(() => mapProtoTitleCards(proto, "titleCards")).toThrowError(message);
  });

  it.each([0, -1000])("rejects a non-positive durationMs (%d)", (durationMs) => {
    expect(() =>
      mapProtoTitleCards({ intro: { title: "T", durationMs } }, "titleCards"),
    ).toThrowError(/durationMs.*greater than 0/);
  });
});
