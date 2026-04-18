import type { ScenarioStep } from "@scenar/core";
import type {
  AuthoredScenario,
  AuthoredStepData,
  ViewRegistry,
} from "../author/types.js";
import { InvalidScenarioError } from "./errors.js";
import type { ProtoScenario } from "./proto-types.js";
import { mapProtoAction } from "./action-mapper.js";

/**
 * Options for {@link loadScenarioFromProto}.
 */
export interface LoadScenarioOptions<Views extends ViewRegistry> {
  /** Map of view identifiers to components / callables. */
  readonly views: Views;
}

/**
 * Convert a proto `Scenario` message into an `AuthoredScenario`
 * ready for `<ScenarioPlayer>`.
 *
 * This is the YAML ingestion path: a scenario parsed from protobuf
 * (or proto-JSON) enters here and comes out as the same shape that
 * `createScenario()` produces.
 *
 * Ensures every step's `view` exists in the views registry and maps
 * proto `StepAction` messages to engine `StepAction` values.
 *
 * @throws {InvalidScenarioError} with a path and reason on any
 *   structural or semantic validation failure.
 */
export function loadScenarioFromProto<Views extends ViewRegistry>(
  scenario: ProtoScenario,
  options: LoadScenarioOptions<Views>,
): AuthoredScenario<Views> {
  if (scenario.steps.length === 0) {
    throw new InvalidScenarioError("steps", "steps array must not be empty.");
  }

  const viewNames = new Set(Object.keys(options.views));
  const steps: ScenarioStep<AuthoredStepData<Views>>[] = [];

  for (let i = 0; i < scenario.steps.length; i++) {
    const protoStep = scenario.steps[i]!;
    const stepPath = `steps[${i}]`;

    if (!protoStep.view) {
      throw new InvalidScenarioError(`${stepPath}.view`, "view is required.");
    }

    if (!viewNames.has(protoStep.view)) {
      throw new InvalidScenarioError(
        `${stepPath}.view`,
        `"${protoStep.view}" is not in the views registry. ` +
        `Registered views: ${[...viewNames].join(", ")}.`,
      );
    }

    const interactions = protoStep.interactions.map((protoAction, j) =>
      mapProtoAction(protoAction, `${stepPath}.interactions[${j}]`),
    );

    steps.push({
      delayMs: protoStep.delayMs,
      data: {
        view: protoStep.view,
        props: (protoStep.props ?? {}) as AuthoredStepData<Views>["props"],
      } as AuthoredStepData<Views>,
      caption: protoStep.caption || undefined,
      narration: protoStep.narrationText || undefined,
      interactions: interactions.length > 0 ? interactions : undefined,
    });
  }

  return {
    viewport: scenario.viewport ? { width: scenario.viewport.width, height: scenario.viewport.height } : undefined,
    views: options.views,
    steps,
  };
}
