import type { ActionType, StepAction } from "@scenar/core";
import { InvalidScenarioError } from "./errors.js";
import { PROTO_ACTION_TYPE, type ProtoStepAction } from "./proto-types.js";

const NUMERIC_TO_ACTION_TYPE: ReadonlyMap<number, ActionType> = new Map([
  [PROTO_ACTION_TYPE.set_cursor, "set_cursor"],
  [PROTO_ACTION_TYPE.clear_cursor, "clear_cursor"],
  [PROTO_ACTION_TYPE.click, "click"],
  [PROTO_ACTION_TYPE.type, "type"],
  [PROTO_ACTION_TYPE.hover, "hover"],
  [PROTO_ACTION_TYPE.drag, "drag"],
  [PROTO_ACTION_TYPE.scroll_to, "scroll_to"],
  [PROTO_ACTION_TYPE.viewport_transition, "viewport_transition"],
]);

/**
 * Map a proto `StepAction` message to the engine's `StepAction` type.
 *
 * Expands the proto `config` oneof into flat optional fields on the
 * engine action. ActionType numeric enum → string literal. Since we
 * aligned the engine's ActionType strings with proto enum names in
 * Phase 1, this is a direct name copy.
 *
 * @param proto - The proto StepAction message (structural shape).
 * @param path  - JSON-path prefix for error reporting.
 */
export function mapProtoAction(proto: ProtoStepAction, path: string): StepAction {
  const actionType = NUMERIC_TO_ACTION_TYPE.get(proto.type);

  if (actionType === undefined) {
    throw new InvalidScenarioError(
      `${path}.type`,
      `unknown ActionType value ${proto.type}. Expected one of: ${[...NUMERIC_TO_ACTION_TYPE.keys()].join(", ")}.`,
    );
  }

  const base: StepAction = {
    atPercent: proto.atPercent,
    type: actionType,
    target: proto.target || undefined,
  };

  const config = proto.config;
  if (!config.case) return base;

  switch (config.case) {
    case "clickConfig":
    case "scrollToConfig":
      return base;

    case "typeConfig":
      return {
        ...base,
        text: config.value.text,
        typeDelay: config.value.typeDelayMs || undefined,
      };

    case "hoverConfig":
      return {
        ...base,
        hoverDuration: config.value.hoverDurationMs || undefined,
      };

    case "dragConfig":
      return {
        ...base,
        dragTarget: config.value.dragTarget,
      };

    case "viewportTransitionConfig":
      return {
        ...base,
        viewportZoom: config.value.viewportZoom || undefined,
        viewportReset: config.value.viewportReset || undefined,
      };

    default: {
      const _exhaustive: never = config;
      return _exhaustive;
    }
  }
}
