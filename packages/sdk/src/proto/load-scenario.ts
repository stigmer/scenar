import type { ScenarioStep } from "@scenar/core";
import type {
  AuthoredScenario,
  AuthoredStepData,
  ViewRegistry,
} from "../author/types.js";
import { InvalidScenarioError } from "./errors.js";
import type { ProtoScenarioSpec } from "./proto-types.js";
import { mapProtoAction } from "./action-mapper.js";
import { mapProtoSoundtrack } from "./soundtrack-mapper.js";
import { mapProtoTitleCards } from "./title-cards-mapper.js";

/**
 * Options for {@link loadScenarioFromProto}.
 */
export interface LoadScenarioOptions<Views extends ViewRegistry> {
  /** Map of view identifiers to components / callables. */
  readonly views: Views;
}

/**
 * Convert a proto `ScenarioSpec` message into an `AuthoredScenario`
 * ready for `<ScenarioPlayer>`.
 *
 * This is the YAML ingestion path: a scenario spec parsed from protobuf
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
  spec: ProtoScenarioSpec,
  options: LoadScenarioOptions<Views>,
): AuthoredScenario<Views> {
  if (spec.steps.length === 0) {
    throw new InvalidScenarioError("steps", "steps array must not be empty.");
  }

  const viewNames = new Set(Object.keys(options.views));
  const steps: ScenarioStep<AuthoredStepData<Views>>[] = [];

  for (let i = 0; i < spec.steps.length; i++) {
    const protoStep = spec.steps[i]!;
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
      narration: protoStep.narrationText || undefined,
      interactions: interactions.length > 0 ? interactions : undefined,
    });
  }

  return {
    viewport: spec.viewport ? { width: spec.viewport.width, height: spec.viewport.height } : undefined,
    views: options.views,
    steps,
    soundtrack: spec.soundtrack
      ? mapProtoSoundtrack(spec.soundtrack, "soundtrack")
      : undefined,
    titleCards: spec.titleCards
      ? mapProtoTitleCards(spec.titleCards, "titleCards")
      : undefined,
  };
}
