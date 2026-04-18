import { PROTO_ACTION_TYPE } from "@scenar/sdk";
import type { ProtoActionTypeValue } from "@scenar/sdk";

export interface ValidationError {
  readonly path: string;
  readonly reason: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ValidationError[];
}

const VALID_ACTION_TYPES = new Set<number>(
  Object.values(PROTO_ACTION_TYPE) as number[],
);

const ACTIONS_REQUIRING_TARGET = new Set<ProtoActionTypeValue>([
  PROTO_ACTION_TYPE.set_cursor,
  PROTO_ACTION_TYPE.click,
  PROTO_ACTION_TYPE.type,
  PROTO_ACTION_TYPE.hover,
  PROTO_ACTION_TYPE.drag,
  PROTO_ACTION_TYPE.scroll_to,
  PROTO_ACTION_TYPE.viewport_transition,
]);

/**
 * Validates a parsed scenario object against the proto schema constraints
 * defined in `scenario.proto` via `buf.validate` annotations.
 *
 * The input is expected to have camelCase keys (post-YAML-loader conversion).
 * Returns all violations found — does not stop at the first error.
 */
export function validateScenario(scenario: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (scenario === null || scenario === undefined || typeof scenario !== "object") {
    errors.push({ path: "", reason: "scenario must be an object." });
    return { valid: false, errors };
  }

  const obj = scenario as Record<string, unknown>;

  validateViewport(obj["viewport"], errors);
  validateSteps(obj["steps"], errors);

  return { valid: errors.length === 0, errors };
}

function validateViewport(
  viewport: unknown,
  errors: ValidationError[],
): void {
  if (viewport === undefined || viewport === null) return;

  if (typeof viewport !== "object") {
    errors.push({ path: "viewport", reason: "viewport must be an object." });
    return;
  }

  const vp = viewport as Record<string, unknown>;

  if (typeof vp["width"] !== "number" || vp["width"] <= 0) {
    errors.push({ path: "viewport.width", reason: "width must be a positive integer." });
  }
  if (typeof vp["height"] !== "number" || vp["height"] <= 0) {
    errors.push({ path: "viewport.height", reason: "height must be a positive integer." });
  }
}

function validateSteps(
  steps: unknown,
  errors: ValidationError[],
): void {
  if (!Array.isArray(steps)) {
    errors.push({ path: "steps", reason: "steps must be an array." });
    return;
  }

  if (steps.length === 0) {
    errors.push({ path: "steps", reason: "steps must contain at least one item." });
    return;
  }

  for (let i = 0; i < steps.length; i++) {
    validateStep(steps[i], `steps[${i}]`, errors);
  }
}

function validateStep(
  step: unknown,
  path: string,
  errors: ValidationError[],
): void {
  if (step === null || step === undefined || typeof step !== "object") {
    errors.push({ path, reason: "step must be an object." });
    return;
  }

  const s = step as Record<string, unknown>;

  if (typeof s["view"] !== "string" || s["view"].length === 0) {
    errors.push({ path: `${path}.view`, reason: "view is required and must be a non-empty string." });
  }

  if (s["delayMs"] !== undefined) {
    if (typeof s["delayMs"] !== "number" || s["delayMs"] < 0) {
      errors.push({ path: `${path}.delayMs`, reason: "delayMs must be a non-negative integer." });
    }
  }

  if (s["interactions"] !== undefined) {
    if (!Array.isArray(s["interactions"])) {
      errors.push({ path: `${path}.interactions`, reason: "interactions must be an array." });
    } else {
      for (let j = 0; j < s["interactions"].length; j++) {
        validateInteraction(
          s["interactions"][j],
          `${path}.interactions[${j}]`,
          errors,
        );
      }
    }
  }
}

function validateInteraction(
  action: unknown,
  path: string,
  errors: ValidationError[],
): void {
  if (action === null || action === undefined || typeof action !== "object") {
    errors.push({ path, reason: "interaction must be an object." });
    return;
  }

  const a = action as Record<string, unknown>;

  if (typeof a["atPercent"] !== "number" || a["atPercent"] < 0 || a["atPercent"] > 1) {
    errors.push({ path: `${path}.atPercent`, reason: "atPercent must be a number between 0.0 and 1.0." });
  }

  const actionType = a["type"];
  if (typeof actionType !== "number" && typeof actionType !== "string") {
    errors.push({ path: `${path}.type`, reason: "type is required." });
  } else {
    const numericType = resolveActionType(actionType);
    if (numericType === undefined || !VALID_ACTION_TYPES.has(numericType)) {
      errors.push({ path: `${path}.type`, reason: `unknown action type: ${String(actionType)}.` });
    } else if (numericType === PROTO_ACTION_TYPE.unspecified) {
      errors.push({ path: `${path}.type`, reason: "action type must not be 'unspecified'." });
    } else {
      if (ACTIONS_REQUIRING_TARGET.has(numericType as ProtoActionTypeValue)) {
        if (typeof a["target"] !== "string" || a["target"].length === 0) {
          errors.push({ path: `${path}.target`, reason: "target is required for this action type." });
        }
      }
    }

    validateActionConfig(a, numericType, path, errors);
  }
}

const ACTION_TYPE_BY_NAME: Record<string, number> = {};
for (const [name, value] of Object.entries(PROTO_ACTION_TYPE)) {
  ACTION_TYPE_BY_NAME[name] = value;
}

function resolveActionType(value: string | number): number | undefined {
  if (typeof value === "number") return value;
  return ACTION_TYPE_BY_NAME[value];
}

function validateActionConfig(
  action: Record<string, unknown>,
  actionType: number | undefined,
  path: string,
  errors: ValidationError[],
): void {
  if (action["typeConfig"] !== undefined) {
    const cfg = action["typeConfig"];
    if (typeof cfg !== "object" || cfg === null) {
      errors.push({ path: `${path}.typeConfig`, reason: "typeConfig must be an object." });
    } else {
      const tc = cfg as Record<string, unknown>;
      if (typeof tc["text"] !== "string" || tc["text"].length === 0) {
        errors.push({ path: `${path}.typeConfig.text`, reason: "text is required and must be a non-empty string." });
      }
      if (tc["typeDelayMs"] !== undefined) {
        if (typeof tc["typeDelayMs"] !== "number" || tc["typeDelayMs"] < 0) {
          errors.push({ path: `${path}.typeConfig.typeDelayMs`, reason: "typeDelayMs must be a non-negative integer." });
        }
      }
    }
  } else if (actionType === PROTO_ACTION_TYPE.type) {
    errors.push({ path: `${path}.typeConfig`, reason: "typeConfig is required for 'type' actions." });
  }

  if (action["hoverConfig"] !== undefined) {
    const cfg = action["hoverConfig"];
    if (typeof cfg !== "object" || cfg === null) {
      errors.push({ path: `${path}.hoverConfig`, reason: "hoverConfig must be an object." });
    } else {
      const hc = cfg as Record<string, unknown>;
      if (hc["hoverDurationMs"] !== undefined) {
        if (typeof hc["hoverDurationMs"] !== "number" || hc["hoverDurationMs"] < 0) {
          errors.push({ path: `${path}.hoverConfig.hoverDurationMs`, reason: "hoverDurationMs must be a non-negative integer." });
        }
      }
    }
  }

  if (action["dragConfig"] !== undefined) {
    const cfg = action["dragConfig"];
    if (typeof cfg !== "object" || cfg === null) {
      errors.push({ path: `${path}.dragConfig`, reason: "dragConfig must be an object." });
    } else {
      const dc = cfg as Record<string, unknown>;
      if (typeof dc["dragTarget"] !== "string" || dc["dragTarget"].length === 0) {
        errors.push({ path: `${path}.dragConfig.dragTarget`, reason: "dragTarget is required and must be a non-empty string." });
      }
    }
  } else if (actionType === PROTO_ACTION_TYPE.drag) {
    errors.push({ path: `${path}.dragConfig`, reason: "dragConfig is required for 'drag' actions." });
  }
}
