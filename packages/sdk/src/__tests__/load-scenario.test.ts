import { describe, expect, it } from "vitest";
import { loadScenarioFromProto } from "../proto/load-scenario.js";
import { InvalidScenarioError } from "../proto/errors.js";
import { PROTO_ACTION_TYPE, type ProtoScenario } from "../proto/proto-types.js";

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

const views = { settings: SettingsView, form: FormView };

function makeValidScenario(): ProtoScenario {
  return {
    apiVersion: "scenar.ai/v1",
    kind: "Scenario",
    spec: {
      viewport: { width: 896, height: 540 },
      steps: [
        {
          view: "settings",
          delayMs: 0,
          caption: "Start here",
          narrationText: "Welcome.",
          props: { org: "acme" },
          interactions: [],
        },
        {
          view: "form",
          delayMs: 1500,
          caption: "Fill the form",
          narrationText: "",
          props: { defaultName: "demo" },
          interactions: [
            {
              atPercent: 0.2,
              type: PROTO_ACTION_TYPE.type,
              target: "name-input",
              config: {
                case: "typeConfig" as const,
                value: { text: "quickstart", typeDelayMs: 0 },
              },
            },
          ],
        },
      ],
    },
  };
}

describe("loadScenarioFromProto", () => {
  it("loads a valid proto scenario into an AuthoredScenario", () => {
    const scenario = loadScenarioFromProto(makeValidScenario(), { views });

    expect(scenario.viewport).toEqual({ width: 896, height: 540 });
    expect(scenario.steps).toHaveLength(2);
    expect(scenario.views).toBe(views);

    expect(scenario.steps[0]!.data.view).toBe("settings");
    expect(scenario.steps[0]!.delayMs).toBe(0);
    expect(scenario.steps[0]!.caption).toBe("Start here");
    expect(scenario.steps[0]!.narration).toBe("Welcome.");
    expect(scenario.steps[0]!.interactions).toBeUndefined();

    expect(scenario.steps[1]!.data.view).toBe("form");
    expect(scenario.steps[1]!.delayMs).toBe(1500);
    expect(scenario.steps[1]!.interactions).toHaveLength(1);
    expect(scenario.steps[1]!.interactions![0]!.type).toBe("type");
    expect(scenario.steps[1]!.interactions![0]!.text).toBe("quickstart");
  });

  it("passes through props from proto Struct as plain object", () => {
    const scenario = loadScenarioFromProto(makeValidScenario(), { views });

    expect(scenario.steps[0]!.data.props).toEqual({ org: "acme" });
    expect(scenario.steps[1]!.data.props).toEqual({ defaultName: "demo" });
  });

  it("defaults props to empty object when proto props is undefined", () => {
    const proto = makeValidScenario();
    const step = { ...proto.spec!.steps[0]!, props: undefined };
    const modified: ProtoScenario = {
      ...proto,
      spec: { ...proto.spec!, steps: [step] },
    };

    const scenario = loadScenarioFromProto(modified, { views });
    expect(scenario.steps[0]!.data.props).toEqual({});
  });

  it("handles scenario with no viewport", () => {
    const proto = makeValidScenario();
    const modified: ProtoScenario = {
      ...proto,
      spec: { ...proto.spec!, viewport: undefined },
    };

    const scenario = loadScenarioFromProto(modified, { views });
    expect(scenario.viewport).toBeUndefined();
  });

  it("throws for wrong apiVersion", () => {
    const proto = { ...makeValidScenario(), apiVersion: "wrong/v1" };

    expect(() => loadScenarioFromProto(proto, { views })).toThrow(
      InvalidScenarioError,
    );

    try {
      loadScenarioFromProto(proto, { views });
    } catch (e) {
      const err = e as InvalidScenarioError;
      expect(err.path).toBe("apiVersion");
      expect(err.reason).toContain("scenar.ai/v1");
    }
  });

  it("throws for wrong kind", () => {
    const proto = { ...makeValidScenario(), kind: "Workflow" };

    expect(() => loadScenarioFromProto(proto, { views })).toThrow(
      InvalidScenarioError,
    );

    try {
      loadScenarioFromProto(proto, { views });
    } catch (e) {
      const err = e as InvalidScenarioError;
      expect(err.path).toBe("kind");
    }
  });

  it("throws when spec is missing", () => {
    const proto: ProtoScenario = {
      apiVersion: "scenar.ai/v1",
      kind: "Scenario",
      spec: undefined,
    };

    expect(() => loadScenarioFromProto(proto, { views })).toThrow(
      /spec is required/,
    );
  });

  it("throws when steps array is empty", () => {
    const proto: ProtoScenario = {
      apiVersion: "scenar.ai/v1",
      kind: "Scenario",
      spec: { steps: [] },
    };

    expect(() => loadScenarioFromProto(proto, { views })).toThrow(
      /steps array must not be empty/,
    );
  });

  it("throws when a step references an unregistered view", () => {
    const proto = makeValidScenario();
    const modified: ProtoScenario = {
      ...proto,
      spec: {
        ...proto.spec!,
        steps: [
          {
            view: "unknown-view",
            delayMs: 0,
            caption: "",
            narrationText: "",
            interactions: [],
          },
        ],
      },
    };

    try {
      loadScenarioFromProto(modified, { views });
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as InvalidScenarioError;
      expect(err.path).toBe("spec.steps[0].view");
      expect(err.reason).toContain("unknown-view");
      expect(err.reason).toContain("settings");
      expect(err.reason).toContain("form");
    }
  });

  it("throws when an action has unspecified type", () => {
    const proto = makeValidScenario();
    const modified: ProtoScenario = {
      ...proto,
      spec: {
        ...proto.spec!,
        steps: [
          {
            ...proto.spec!.steps[0]!,
            interactions: [
              {
                atPercent: 0.5,
                type: PROTO_ACTION_TYPE.unspecified,
                target: "x",
                config: { case: undefined },
              },
            ],
          },
        ],
      },
    };

    try {
      loadScenarioFromProto(modified, { views });
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as InvalidScenarioError;
      expect(err.path).toBe("spec.steps[0].interactions[0].type");
    }
  });

  it("omits empty narration and caption strings", () => {
    const proto = makeValidScenario();
    const modified: ProtoScenario = {
      ...proto,
      spec: {
        ...proto.spec!,
        steps: [
          {
            view: "settings",
            delayMs: 0,
            caption: "",
            narrationText: "",
            interactions: [],
          },
        ],
      },
    };

    const scenario = loadScenarioFromProto(modified, { views });
    expect(scenario.steps[0]!.caption).toBeUndefined();
    expect(scenario.steps[0]!.narration).toBeUndefined();
  });
});
