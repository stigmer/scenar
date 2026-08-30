import type { Soundtrack } from "@scenar/core";
import { InvalidScenarioError } from "./errors.js";
import type { ProtoSoundtrackConfig } from "./proto-types.js";

/**
 * Map a proto `SoundtrackConfig` message to the engine's `Soundtrack`
 * type, enforcing the same rules the proto declares via `buf.validate`
 * (musicSrc non-empty when present, volumes within [0, 1]).
 *
 * All proto fields are `optional`, so absence passes through as
 * `undefined` — the engine resolves defaults at playback time, keeping
 * an authored 0.0 distinguishable from "use the default".
 *
 * @param proto - The proto SoundtrackConfig message (structural shape).
 * @param path  - JSON-path prefix for error reporting.
 */
export function mapProtoSoundtrack(
  proto: ProtoSoundtrackConfig,
  path: string,
): Soundtrack {
  if (proto.musicSrc !== undefined && proto.musicSrc.length === 0) {
    throw new InvalidScenarioError(
      `${path}.musicSrc`,
      "musicSrc must be a non-empty asset reference when present.",
    );
  }

  validateVolume(proto.musicVolume, `${path}.musicVolume`);
  validateVolume(proto.duckingVolume, `${path}.duckingVolume`);

  return {
    musicSrc: proto.musicSrc,
    musicVolume: proto.musicVolume,
    duckingVolume: proto.duckingVolume,
    sfx: proto.sfx,
  };
}

function validateVolume(value: number | undefined, path: string): void {
  if (value === undefined) return;
  if (value < 0 || value > 1) {
    throw new InvalidScenarioError(path, `must be between 0.0 and 1.0, got ${value}.`);
  }
}
