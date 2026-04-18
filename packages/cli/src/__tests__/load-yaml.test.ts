import { describe, it, expect } from "vitest";
import { snakeToCamelKeys } from "../util/load-yaml.js";

describe("snakeToCamelKeys", () => {
  it("converts flat object keys from snake_case to camelCase", () => {
    expect(snakeToCamelKeys({ delay_ms: 100, narration_text: "hello" }))
      .toEqual({ delayMs: 100, narrationText: "hello" });
  });

  it("converts nested object keys recursively", () => {
    const input = {
      viewport: { width: 896, height: 540 },
      steps: [
        {
          view: "login",
          delay_ms: 0,
          interactions: [
            {
              at_percent: 0.3,
              type: "hover",
              target: "btn",
              hover_config: { hover_duration_ms: 1500 },
            },
          ],
        },
      ],
    };

    const output = snakeToCamelKeys(input);
    expect(output).toEqual({
      viewport: { width: 896, height: 540 },
      steps: [
        {
          view: "login",
          delayMs: 0,
          interactions: [
            {
              atPercent: 0.3,
              type: "hover",
              target: "btn",
              hoverConfig: { hoverDurationMs: 1500 },
            },
          ],
        },
      ],
    });
  });

  it("passes primitives through unchanged", () => {
    expect(snakeToCamelKeys(42)).toBe(42);
    expect(snakeToCamelKeys("hello")).toBe("hello");
    expect(snakeToCamelKeys(null)).toBeNull();
    expect(snakeToCamelKeys(true)).toBe(true);
  });

  it("handles empty objects and arrays", () => {
    expect(snakeToCamelKeys({})).toEqual({});
    expect(snakeToCamelKeys([])).toEqual([]);
  });

  it("leaves already-camelCase keys unchanged", () => {
    expect(snakeToCamelKeys({ delayMs: 100 })).toEqual({ delayMs: 100 });
  });

  it("handles keys with multiple underscores", () => {
    expect(snakeToCamelKeys({ viewport_transition_config: {} }))
      .toEqual({ viewportTransitionConfig: {} });
  });

  it("handles type_config with nested fields", () => {
    const input = {
      type_config: { text: "hello", type_delay_ms: 50 },
    };
    expect(snakeToCamelKeys(input)).toEqual({
      typeConfig: { text: "hello", typeDelayMs: 50 },
    });
  });
});
