import type { ScenarioStep } from "@scenar/core";
import type {
  AuthoredScenario,
  AuthoredStepData,
  ScenarioInput,
  StepInput,
  ViewRegistry,
} from "./types.js";

/**
 * Build a type-safe scenario from a view registry and step definitions.
 *
 * Each step's `props` is statically validated against the component
 * registered under its `view` name — no `any`, no `JsonObject`.
 *
 * ```ts
 * const scenario = createScenario({
 *   viewport: { width: 896, height: 540 },
 *   views: { settings: SettingsView, form: FormView },
 *   steps: [
 *     { view: "settings", delayMs: 0, props: { org: "acme" } },
 *     { view: "form", delayMs: 1500, props: { defaultName: "demo" } },
 *   ],
 * });
 * ```
 *
 * @throws {Error} if `steps` is empty or a step references an
 *   unregistered view name.
 */
export function createScenario<Views extends ViewRegistry>(
  input: ScenarioInput<Views>,
): AuthoredScenario<Views> {
  if (input.steps.length === 0) {
    throw new Error("[scenar] createScenario: steps array must not be empty.");
  }

  const viewNames = new Set(Object.keys(input.views));
  const steps: ScenarioStep<AuthoredStepData<Views>>[] = [];

  for (let i = 0; i < input.steps.length; i++) {
    const step = input.steps[i] as StepInput<Views>;

    if (!viewNames.has(step.view)) {
      throw new Error(
        `[scenar] createScenario: step[${i}].view "${step.view}" is not in the views registry. ` +
        `Registered views: ${[...viewNames].join(", ")}.`,
      );
    }

    steps.push({
      delayMs: step.delayMs,
      data: { view: step.view, props: step.props } as AuthoredStepData<Views>,
      caption: step.caption,
      narration: step.narrationText,
      interactions: step.interactions,
    });
  }

  return {
    viewport: input.viewport,
    views: input.views,
    steps,
  };
}
