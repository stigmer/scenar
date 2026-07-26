import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, within } from "@testing-library/react";
import { createRef } from "react";
import {
  CAMERA_TRANSITION_MS,
  VIEWPORT_TRANSFORM_IDENTITY,
  interpolateViewportTransform,
} from "@scenar/core";
import { TimeSourceProvider } from "../time/TimeSource.js";
import { VideoExportProvider } from "../video/VideoExportContext.js";
import { ViewportTransformLayer } from "./ViewportTransformLayer.js";

afterEach(cleanup);

const ZOOMED = { scale: 1.5, x: -200, y: -120 } as const;

/** Render the layer inside the export providers at a given timeline time. */
function exportLayer(currentTimeMs: number, transform = ZOOMED) {
  return (
    <VideoExportProvider>
      <TimeSourceProvider currentTimeMs={currentTimeMs} stepStartTimesMs={[0]}>
        <ViewportTransformLayer transform={transform}>
          <p>content</p>
        </ViewportTransformLayer>
      </TimeSourceProvider>
    </VideoExportProvider>
  );
}

/** The transformed content element (the div carrying the inline transform). */
function contentEl(container: HTMLElement): HTMLElement {
  return within(container).getByText("content").parentElement as HTMLElement;
}

function expectedStyle(t: { scale: number; x: number; y: number }): string {
  return `translate(${t.x}px, ${t.y}px) scale(${t.scale})`;
}

describe("ViewportTransformLayer (browser playback)", () => {
  it("renders children and attaches contentRef to the transformed element", () => {
    const ref = createRef<HTMLDivElement>();
    const { container } = render(
      <ViewportTransformLayer transform={VIEWPORT_TRANSFORM_IDENTITY} contentRef={ref}>
        <p>content</p>
      </ViewportTransformLayer>,
    );
    expect(within(container).getByText("content")).toBeDefined();
    expect(ref.current).toBe(contentEl(container));
  });

  it("clips overflow when the transform is away from identity", () => {
    const { container } = render(
      <ViewportTransformLayer transform={ZOOMED}>
        <p>content</p>
      </ViewportTransformLayer>,
    );
    expect((container.firstElementChild as HTMLElement).className).toContain(
      "overflow-hidden",
    );
  });
});

describe("ViewportTransformLayer (video export)", () => {
  it("renders the exact `from` transform the instant a move fires", () => {
    // Mount at rest identity, then retarget at t=1000: the move starts from
    // identity, so at its own firing instant the rendered transform is still
    // identity.
    const { container, rerender } = render(
      exportLayer(0, VIEWPORT_TRANSFORM_IDENTITY),
    );
    rerender(exportLayer(1000, ZOOMED));
    expect(contentEl(container).style.transform).toBe(
      expectedStyle(VIEWPORT_TRANSFORM_IDENTITY),
    );
  });

  it("renders the interpolated transform mid-move — frame-time parity with the core curve", () => {
    const { container, rerender } = render(
      exportLayer(0, VIEWPORT_TRANSFORM_IDENTITY),
    );
    rerender(exportLayer(1000, ZOOMED));

    const midMs = 1000 + CAMERA_TRANSITION_MS / 2;
    rerender(exportLayer(midMs, ZOOMED));

    const expected = interpolateViewportTransform(
      VIEWPORT_TRANSFORM_IDENTITY,
      ZOOMED,
      0.5,
    );
    expect(contentEl(container).style.transform).toBe(expectedStyle(expected));
  });

  it("rests exactly on the target transform once the move completes", () => {
    const { container, rerender } = render(
      exportLayer(0, VIEWPORT_TRANSFORM_IDENTITY),
    );
    rerender(exportLayer(1000, ZOOMED));
    rerender(exportLayer(1000 + CAMERA_TRANSITION_MS + 40, ZOOMED));
    expect(contentEl(container).style.transform).toBe(expectedStyle(ZOOMED));
  });

  it("retargets mid-move from the currently rendered transform, not the old endpoint", () => {
    const { container, rerender } = render(
      exportLayer(0, VIEWPORT_TRANSFORM_IDENTITY),
    );
    rerender(exportLayer(1000, ZOOMED));

    // Interrupt halfway with a reset-to-identity: the new move must start
    // from the mid-flight transform (matching how the browser tween handles
    // interruption), then land exactly on identity.
    const midMs = 1000 + CAMERA_TRANSITION_MS / 2;
    const midTransform = interpolateViewportTransform(
      VIEWPORT_TRANSFORM_IDENTITY,
      ZOOMED,
      0.5,
    );
    rerender(exportLayer(midMs, VIEWPORT_TRANSFORM_IDENTITY));
    expect(contentEl(container).style.transform).toBe(expectedStyle(midTransform));

    rerender(
      exportLayer(midMs + CAMERA_TRANSITION_MS, VIEWPORT_TRANSFORM_IDENTITY),
    );
    expect(contentEl(container).style.transform).toBe(
      expectedStyle(VIEWPORT_TRANSFORM_IDENTITY),
    );
  });

  it("clips while zoomed and unclips at rest identity", () => {
    const { container, rerender } = render(
      exportLayer(0, VIEWPORT_TRANSFORM_IDENTITY),
    );
    expect((container.firstElementChild as HTMLElement).className).toBe("");

    rerender(exportLayer(1000, ZOOMED));
    rerender(exportLayer(1000 + CAMERA_TRANSITION_MS, ZOOMED));
    expect((container.firstElementChild as HTMLElement).className).toContain(
      "overflow-hidden",
    );
  });
});
