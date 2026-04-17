import { describe, expect, it } from "vitest";
import { mapProtoAction } from "../proto/action-mapper.js";
import { PROTO_ACTION_TYPE, type ProtoStepAction } from "../proto/proto-types.js";

function makeAction(overrides: Partial<ProtoStepAction>): ProtoStepAction {
  return {
    atPercent: 0.5,
    type: PROTO_ACTION_TYPE.click,
    target: "btn",
    config: { case: undefined },
    ...overrides,
  };
}

describe("mapProtoAction", () => {
  it("maps set_cursor", () => {
    const result = mapProtoAction(
      makeAction({ type: PROTO_ACTION_TYPE.set_cursor, target: "el" }),
      "test",
    );
    expect(result.type).toBe("set_cursor");
    expect(result.target).toBe("el");
    expect(result.atPercent).toBe(0.5);
  });

  it("maps clear_cursor", () => {
    const result = mapProtoAction(
      makeAction({ type: PROTO_ACTION_TYPE.clear_cursor, target: "" }),
      "test",
    );
    expect(result.type).toBe("clear_cursor");
    expect(result.target).toBeUndefined();
  });

  it("maps click", () => {
    const result = mapProtoAction(
      makeAction({
        type: PROTO_ACTION_TYPE.click,
        config: { case: "clickConfig", value: {} },
      }),
      "test",
    );
    expect(result.type).toBe("click");
    expect(result.target).toBe("btn");
  });

  it("maps type with typeConfig", () => {
    const result = mapProtoAction(
      makeAction({
        type: PROTO_ACTION_TYPE.type,
        config: {
          case: "typeConfig",
          value: { text: "hello", typeDelayMs: 80 },
        },
      }),
      "test",
    );
    expect(result.type).toBe("type");
    expect(result.text).toBe("hello");
    expect(result.typeDelay).toBe(80);
  });

  it("maps type with zero typeDelayMs as undefined (engine default)", () => {
    const result = mapProtoAction(
      makeAction({
        type: PROTO_ACTION_TYPE.type,
        config: {
          case: "typeConfig",
          value: { text: "hi", typeDelayMs: 0 },
        },
      }),
      "test",
    );
    expect(result.typeDelay).toBeUndefined();
  });

  it("maps hover with hoverConfig", () => {
    const result = mapProtoAction(
      makeAction({
        type: PROTO_ACTION_TYPE.hover,
        config: {
          case: "hoverConfig",
          value: { hoverDurationMs: 2000 },
        },
      }),
      "test",
    );
    expect(result.type).toBe("hover");
    expect(result.hoverDuration).toBe(2000);
  });

  it("maps hover with zero hoverDurationMs as undefined (engine default)", () => {
    const result = mapProtoAction(
      makeAction({
        type: PROTO_ACTION_TYPE.hover,
        config: {
          case: "hoverConfig",
          value: { hoverDurationMs: 0 },
        },
      }),
      "test",
    );
    expect(result.hoverDuration).toBeUndefined();
  });

  it("maps drag with dragConfig", () => {
    const result = mapProtoAction(
      makeAction({
        type: PROTO_ACTION_TYPE.drag,
        target: "card",
        config: {
          case: "dragConfig",
          value: { dragTarget: "slot" },
        },
      }),
      "test",
    );
    expect(result.type).toBe("drag");
    expect(result.target).toBe("card");
    expect(result.dragTarget).toBe("slot");
  });

  it("maps scroll_to", () => {
    const result = mapProtoAction(
      makeAction({
        type: PROTO_ACTION_TYPE.scroll_to,
        target: "section",
        config: { case: "scrollToConfig", value: {} },
      }),
      "test",
    );
    expect(result.type).toBe("scroll_to");
    expect(result.target).toBe("section");
  });

  it("maps viewport_transition with config", () => {
    const result = mapProtoAction(
      makeAction({
        type: PROTO_ACTION_TYPE.viewport_transition,
        target: "panel",
        config: {
          case: "viewportTransitionConfig",
          value: { viewportZoom: 2.0, viewportReset: false },
        },
      }),
      "test",
    );
    expect(result.type).toBe("viewport_transition");
    expect(result.viewportZoom).toBe(2.0);
    expect(result.viewportReset).toBeUndefined();
  });

  it("maps viewport_transition with reset", () => {
    const result = mapProtoAction(
      makeAction({
        type: PROTO_ACTION_TYPE.viewport_transition,
        config: {
          case: "viewportTransitionConfig",
          value: { viewportZoom: 0, viewportReset: true },
        },
      }),
      "test",
    );
    expect(result.viewportReset).toBe(true);
  });

  it("throws InvalidScenarioError for unspecified action type", () => {
    expect(() =>
      mapProtoAction(
        makeAction({ type: PROTO_ACTION_TYPE.unspecified }),
        "spec.steps[2].interactions[0]",
      ),
    ).toThrow(/unknown ActionType value 0/);
  });

  it("throws InvalidScenarioError for unknown numeric type", () => {
    expect(() =>
      mapProtoAction(makeAction({ type: 99 }), "spec.steps[0].interactions[0]"),
    ).toThrow(/unknown ActionType value 99/);
  });

  it("error includes the provided path", () => {
    try {
      mapProtoAction(
        makeAction({ type: PROTO_ACTION_TYPE.unspecified }),
        "spec.steps[3].interactions[1]",
      );
      expect.fail("should have thrown");
    } catch (e) {
      expect((e as { path: string }).path).toBe(
        "spec.steps[3].interactions[1].type",
      );
    }
  });
});
