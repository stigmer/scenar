import type { TitleCard, TitleCards } from "@scenar/core";
import { InvalidScenarioError } from "./errors.js";
import type { ProtoTitleCard, ProtoTitleCardsConfig } from "./proto-types.js";

/**
 * Map a proto `TitleCardsConfig` message to the engine's `TitleCards`
 * type, enforcing the same rules the proto declares via `buf.validate`
 * (title required and non-empty; optional strings non-empty when
 * present; durationMs positive when present).
 *
 * Mapping only — card synthesis happens later, at bundle assembly, via
 * `applyTitleCards`. The loader carries the config through untouched,
 * exactly like `soundtrack`.
 *
 * @param proto - The proto TitleCardsConfig message (structural shape).
 * @param path  - JSON-path prefix for error reporting.
 */
export function mapProtoTitleCards(
  proto: ProtoTitleCardsConfig,
  path: string,
): TitleCards {
  return {
    intro: proto.intro ? mapCard(proto.intro, `${path}.intro`) : undefined,
    outro: proto.outro ? mapCard(proto.outro, `${path}.outro`) : undefined,
  };
}

function mapCard(proto: ProtoTitleCard, path: string): TitleCard {
  if (!proto.title) {
    throw new InvalidScenarioError(`${path}.title`, "title is required.");
  }
  validateNonEmpty(proto.subtitle, `${path}.subtitle`);
  validateNonEmpty(proto.logoSrc, `${path}.logoSrc`);
  validateNonEmpty(proto.ctaText, `${path}.ctaText`);
  if (proto.durationMs !== undefined && proto.durationMs <= 0) {
    throw new InvalidScenarioError(
      `${path}.durationMs`,
      `must be greater than 0, got ${proto.durationMs}.`,
    );
  }

  return {
    title: proto.title,
    subtitle: proto.subtitle,
    logoSrc: proto.logoSrc,
    ctaText: proto.ctaText,
    durationMs: proto.durationMs,
  };
}

function validateNonEmpty(value: string | undefined, path: string): void {
  if (value !== undefined && value.length === 0) {
    throw new InvalidScenarioError(path, "must be non-empty when present.");
  }
}
