import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PresenterEntry, PresenterWindow } from "@scenar/core";
import { PresenterFrame } from "./PresenterFrame.js";

/**
 * Frame geometry (scenar#30): the 24%-wide 16:9 box is a MAXIMUM; a
 * dimensioned entry shrinks one axis so the frame's aspect matches the
 * clip exactly and nothing is ever cover-cropped. Asserted through the
 * rendered style — the same values both playback surfaces consume.
 */

const WINDOW: PresenterWindow = { stepIndex: 0, startMs: 0, clipDurationMs: 4_000 };

function renderFrame(entry: PresenterEntry): HTMLElement {
  const { container } = render(
    <PresenterFrame entry={entry} window={WINDOW} sizeVariant="chrome" />,
  );
  return container.querySelector("[data-scenar-presenter]") as HTMLElement;
}

afterEach(cleanup);

describe("PresenterFrame geometry", () => {
  it("keeps the legacy 16:9 max box for an entry without dimensions", () => {
    const frame = renderFrame({ src: "./step-0.mp4", durationMs: 4_000 });
    expect(frame.style.width).toBe("var(--scenar-presenter-width, 24%)");
    expect(frame.style.aspectRatio).toBe("16 / 9");
  });

  it("fills the max box exactly for a 16:9 clip (pixel-identical to legacy)", () => {
    const frame = renderFrame({
      src: "./step-0.mp4",
      durationMs: 4_000,
      width: 1280,
      height: 720,
    });
    expect(frame.style.width).toBe("var(--scenar-presenter-width, 24%)");
    expect(frame.style.aspectRatio).toBe("1280 / 720");
  });

  it("keeps the max box's height and gives up width for a near-square clip", () => {
    const frame = renderFrame({
      src: "./step-0.mp4",
      durationMs: 4_000,
      width: 788,
      height: 720,
    });
    // (9 * 788) / (16 * 720) — the width whose 788:720 frame is exactly
    // as tall as the 16:9 max box.
    expect(frame.style.width).toBe(
      `calc(var(--scenar-presenter-width, 24%) * ${(9 * 788) / (16 * 720)})`,
    );
    expect(frame.style.aspectRatio).toBe("788 / 720");
  });

  it("keeps the token width and gets shorter for a wider-than-16:9 clip", () => {
    const frame = renderFrame({
      src: "./step-0.mp4",
      durationMs: 4_000,
      width: 2100,
      height: 900,
    });
    expect(frame.style.width).toBe("var(--scenar-presenter-width, 24%)");
    expect(frame.style.aspectRatio).toBe("2100 / 900");
  });

  it("degrades malformed dimensions to the legacy frame (manifest JSON is a boundary)", () => {
    for (const dims of [
      { width: 0, height: 720 },
      { width: 788, height: 0 },
      { width: Number.NaN, height: 720 },
      { width: 788, height: Number.POSITIVE_INFINITY },
      { width: -788, height: 720 },
    ]) {
      const frame = renderFrame({ src: "./step-0.mp4", durationMs: 4_000, ...dims });
      expect(frame.style.width).toBe("var(--scenar-presenter-width, 24%)");
      expect(frame.style.aspectRatio).toBe("16 / 9");
      cleanup();
    }
  });
});
