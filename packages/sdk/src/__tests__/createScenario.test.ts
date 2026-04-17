import { describe, expect, it } from "vitest";
import { createScenario } from "../author/createScenario.js";

interface SettingsProps {
  readonly org: string;
}

interface FormProps {
  readonly defaultName: string;
}

function SettingsView(_props: SettingsProps): unknown {
  return null;
}

function FormView(_props: FormProps): unknown {
  return null;
}

describe("createScenario", () => {
  it("builds an AuthoredScenario from valid input", () => {
    const scenario = createScenario({
      viewport: { width: 896, height: 540 },
      views: { settings: SettingsView, form: FormView },
      steps: [
        { view: "settings", delayMs: 0, caption: "Start", props: { org: "acme" } },
        {
          view: "form",
          delayMs: 1500,
          caption: "Fill",
          narrationText: "Enter your key name.",
          props: { defaultName: "demo" },
          interactions: [
            { atPercent: 0.2, type: "type", target: "name-input", text: "quickstart" },
          ],
        },
      ],
    });

    expect(scenario.viewport).toEqual({ width: 896, height: 540 });
    expect(scenario.steps).toHaveLength(2);

    expect(scenario.steps[0]!.delayMs).toBe(0);
    expect(scenario.steps[0]!.data.view).toBe("settings");
    expect(scenario.steps[0]!.data.props).toEqual({ org: "acme" });
    expect(scenario.steps[0]!.caption).toBe("Start");
    expect(scenario.steps[0]!.interactions).toBeUndefined();

    expect(scenario.steps[1]!.delayMs).toBe(1500);
    expect(scenario.steps[1]!.data.view).toBe("form");
    expect(scenario.steps[1]!.data.props).toEqual({ defaultName: "demo" });
    expect(scenario.steps[1]!.narration).toBe("Enter your key name.");
    expect(scenario.steps[1]!.interactions).toHaveLength(1);
    expect(scenario.steps[1]!.interactions![0]!.type).toBe("type");
    expect(scenario.steps[1]!.interactions![0]!.text).toBe("quickstart");
  });

  it("preserves view registry on the output", () => {
    const views = { settings: SettingsView };
    const scenario = createScenario({
      views,
      steps: [{ view: "settings", delayMs: 0, props: { org: "a" } }],
    });

    expect(scenario.views).toBe(views);
  });

  it("accepts undefined viewport", () => {
    const scenario = createScenario({
      views: { settings: SettingsView },
      steps: [{ view: "settings", delayMs: 0, props: { org: "a" } }],
    });

    expect(scenario.viewport).toBeUndefined();
  });

  it("throws when steps array is empty", () => {
    expect(() =>
      createScenario({
        views: { settings: SettingsView },
        steps: [],
      }),
    ).toThrow("steps array must not be empty");
  });

  it("throws when a step references an unregistered view", () => {
    expect(() =>
      createScenario({
        views: { settings: SettingsView },
        steps: [
          // @ts-expect-error — intentional runtime error test
          { view: "nonexistent", delayMs: 0, props: {} },
        ],
      }),
    ).toThrow(/step\[0\]\.view "nonexistent" is not in the views registry/);
  });

  it("maps narrationText to the engine narration field", () => {
    const scenario = createScenario({
      views: { settings: SettingsView },
      steps: [
        { view: "settings", delayMs: 0, narrationText: "Hello", props: { org: "a" } },
      ],
    });

    expect(scenario.steps[0]!.narration).toBe("Hello");
  });
});
