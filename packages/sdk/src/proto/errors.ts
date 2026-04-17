/**
 * Thrown when a proto `Scenario` message fails validation during
 * `loadScenarioFromProto`. Includes the JSON-path to the offending
 * field and a human-readable reason.
 */
export class InvalidScenarioError extends Error {
  readonly path: string;
  readonly reason: string;

  constructor(path: string, reason: string) {
    super(`[scenar] Invalid scenario at ${path}: ${reason}`);
    this.name = "InvalidScenarioError";
    this.path = path;
    this.reason = reason;
  }
}
