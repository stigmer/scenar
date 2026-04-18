import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("remotion", () => ({
  useCurrentFrame: () => 0,
  useVideoConfig: () => ({ fps: 30, width: 1920, height: 1080, durationInFrames: 300 }),
  AbsoluteFill: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Audio: ({ src }: { src: string }) => (
    <audio data-testid="remotion-audio" data-remotion-audio="true" src={src} />
  ),
  Sequence: ({
    from,
    durationInFrames,
    children,
  }: {
    from: number;
    durationInFrames?: number;
    children: React.ReactNode;
  }) => (
    <div
      data-testid="remotion-sequence"
      data-from={from}
      data-duration={durationInFrames}
    >
      {children}
    </div>
  ),
  staticFile: (path: string) => `/static/${path}`,
}));

import type { ScenarioBundle, NarrationManifest } from "@scenar/core";
import { ScenarioComposition } from "../ScenarioComposition.js";

type StepData = { view: string };

const bundle: ScenarioBundle<StepData> = {
  id: "test-scenario",
  steps: [
    { delayMs: 0, data: { view: "intro" } },
    { delayMs: 2000, data: { view: "body" } },
    { delayMs: 1500, data: { view: "outro" } },
  ],
};

const manifest: NarrationManifest = {
  steps: [
    { src: "/audio/step-0.mp3", durationMs: 3000 },
    null,
    { src: "/audio/step-2.mp3", durationMs: 2000 },
  ],
};

const bundleWithNarration: ScenarioBundle<StepData> = {
  ...bundle,
  narrationManifest: manifest,
};

describe("ScenarioComposition", () => {
  it("renders children with the first step data at frame 0", () => {
    const renderFn = vi.fn((data: StepData) => <div>{data.view}</div>);

    const { getByText } = render(
      <ScenarioComposition bundle={bundle}>
        {renderFn}
      </ScenarioComposition>,
    );

    expect(getByText("intro")).toBeTruthy();
  });

  it("places Remotion Audio elements for narrated steps via staticFile", () => {
    const { container } = render(
      <ScenarioComposition bundle={bundleWithNarration}>
        {(data: StepData) => <div>{data.view}</div>}
      </ScenarioComposition>,
    );

    const remotionAudios = container.querySelectorAll("[data-remotion-audio]");
    expect(remotionAudios).toHaveLength(2);
    // staticFile strips leading "/" → staticFile("audio/step-0.mp3") → "/static/audio/step-0.mp3"
    expect(remotionAudios[0]!.getAttribute("src")).toBe("/static/audio/step-0.mp3");
    expect(remotionAudios[1]!.getAttribute("src")).toBe("/static/audio/step-2.mp3");
  });

  it("wraps audio in Sequences with correct frame offsets and durations", () => {
    const { container } = render(
      <ScenarioComposition bundle={bundleWithNarration}>
        {(data: StepData) => <div>{data.view}</div>}
      </ScenarioComposition>,
    );

    const sequences = container.querySelectorAll("[data-testid='remotion-sequence']");
    expect(sequences).toHaveLength(2);

    // Step 0 starts at frame 0, duration = Math.round(3000 * 30 / 1000) = 90 frames
    expect(sequences[0]!.getAttribute("data-from")).toBe("0");
    expect(sequences[0]!.getAttribute("data-duration")).toBe("90");

    // Step 2: starts at max(2000, 3000) + max(1500, 0) = 3000 + 1500 = 4500ms
    // → Math.round(4500 * 30 / 1000) = 135 frames
    // duration = Math.round(2000 * 30 / 1000) = 60 frames
    expect(sequences[1]!.getAttribute("data-from")).toBe("135");
    expect(sequences[1]!.getAttribute("data-duration")).toBe("60");
  });

  it("renders no Remotion audio when bundle has no narration manifest", () => {
    const { container } = render(
      <ScenarioComposition bundle={bundle}>
        {(data: StepData) => <div>{data.view}</div>}
      </ScenarioComposition>,
    );

    expect(container.querySelectorAll("[data-remotion-audio]")).toHaveLength(0);
    expect(container.querySelectorAll("[data-testid='remotion-sequence']")).toHaveLength(0);
  });

  it("passes raw src when useStaticFile is false", () => {
    const { container } = render(
      <ScenarioComposition bundle={bundleWithNarration} useStaticFile={false}>
        {(data: StepData) => <div>{data.view}</div>}
      </ScenarioComposition>,
    );

    const remotionAudios = container.querySelectorAll("[data-remotion-audio]");
    expect(remotionAudios[0]!.getAttribute("src")).toBe("/audio/step-0.mp3");
    expect(remotionAudios[1]!.getAttribute("src")).toBe("/audio/step-2.mp3");
  });
});
