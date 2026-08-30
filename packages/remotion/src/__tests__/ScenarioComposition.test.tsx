import { beforeEach, describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

/** Props of every rendered Remotion `Audio`, in render order — lets tests
 * inspect the `volume` function and `loop` flag the DOM cannot carry. */
const captured = vi.hoisted(() => ({
  audios: [] as Array<{ src: string; loop?: boolean; volume?: (f: number) => number }>,
}));

vi.mock("remotion", () => ({
  useCurrentFrame: () => 0,
  useVideoConfig: () => ({ fps: 30, width: 1920, height: 1080, durationInFrames: 300 }),
  AbsoluteFill: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Audio: (props: { src: string; loop?: boolean; volume?: (f: number) => number }) => {
    captured.audios.push(props);
    return (
      <audio
        data-testid="remotion-audio"
        data-remotion-audio="true"
        data-loop={props.loop ? "true" : undefined}
        src={props.src}
      />
    );
  },
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

import {
  type NarrationManifest,
  type ScenarioBundle,
  CLICK_DELAY_MS,
  computeMusicEnvelope,
  musicGainAt,
} from "@scenar/core";
import { ScenarioComposition } from "../ScenarioComposition.js";

beforeEach(() => {
  captured.audios = [];
});

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

// --- Soundtrack ---

const bundleWithMusic: ScenarioBundle<StepData> = {
  ...bundleWithNarration,
  soundtrack: { musicSrc: "./soundtrack/music.mp3", musicVolume: 0.5, duckingVolume: 0.1 },
};

const bundleWithSfx: ScenarioBundle<StepData> = {
  ...bundle,
  soundtrack: { sfx: true },
  steps: [
    {
      delayMs: 0,
      data: { view: "intro" },
      interactions: [{ atPercent: 0, type: "click", target: "btn" }],
    },
    { delayMs: 2000, data: { view: "body" } },
  ],
};

describe("ScenarioComposition soundtrack", () => {
  it("renders a looping music track resolved through staticFile", () => {
    render(
      <ScenarioComposition bundle={bundleWithMusic}>
        {(data: StepData) => <div>{data.view}</div>}
      </ScenarioComposition>,
    );

    const music = captured.audios.find((a) => a.loop);
    expect(music).toBeDefined();
    // "./soundtrack/music.mp3" strips its leading "./" before staticFile.
    expect(music!.src).toBe("/static/soundtrack/music.mp3");
    expect(typeof music!.volume).toBe("function");
  });

  it("drives the music volume from the shared core envelope (parity)", () => {
    render(
      <ScenarioComposition bundle={bundleWithMusic}>
        {(data: StepData) => <div>{data.view}</div>}
      </ScenarioComposition>,
    );

    const volume = captured.audios.find((a) => a.loop)!.volume!;
    const envelope = computeMusicEnvelope(
      bundleWithMusic.steps,
      bundleWithMusic.narrationManifest,
      bundleWithMusic.soundtrack!,
    );
    // Sample across fade-in, ducked narration, and the plateau: the frame
    // function must agree with the pure envelope at the frame's time.
    for (const frame of [0, 15, 30, 90, 100, 135, 150]) {
      expect(volume(frame)).toBe(musicGainAt(envelope, (frame / 30) * 1000));
    }
  });

  it("is deterministic: two renders produce identical volume samples", () => {
    render(
      <ScenarioComposition bundle={bundleWithMusic}>
        {(data: StepData) => <div>{data.view}</div>}
      </ScenarioComposition>,
    );
    const first = captured.audios.find((a) => a.loop)!.volume!;
    const firstSamples = [0, 10, 50, 120, 149].map((f) => first(f));

    captured.audios = [];
    render(
      <ScenarioComposition bundle={bundleWithMusic}>
        {(data: StepData) => <div>{data.view}</div>}
      </ScenarioComposition>,
    );
    const second = captured.audios.find((a) => a.loop)!.volume!;
    expect([0, 10, 50, 120, 149].map((f) => second(f))).toEqual(firstSamples);
  });

  it("places SFX sequences at the derived frame offsets", () => {
    const { container } = render(
      <ScenarioComposition bundle={bundleWithSfx}>
        {(data: StepData) => <div>{data.view}</div>}
      </ScenarioComposition>,
    );

    // One click at atPercent 0 in a 2000ms step: dispatch at 450ms
    // (CLICK_DELAY_MS) → frame round(450 * 30 / 1000) = 14.
    const sequences = container.querySelectorAll("[data-testid='remotion-sequence']");
    expect(sequences).toHaveLength(1);
    expect(sequences[0]!.getAttribute("data-from")).toBe(
      String(Math.round((CLICK_DELAY_MS * 30) / 1000)),
    );

    const sfxAudio = captured.audios.find((a) => a.src.includes("sfx"));
    expect(sfxAudio!.src).toBe("/static/soundtrack/sfx/click.mp3");
  });

  it("renders no soundtrack audio when the bundle has none", () => {
    render(
      <ScenarioComposition bundle={bundleWithNarration}>
        {(data: StepData) => <div>{data.view}</div>}
      </ScenarioComposition>,
    );
    expect(captured.audios.some((a) => a.loop)).toBe(false);
    expect(captured.audios.some((a) => a.src.includes("sfx"))).toBe(false);
  });
});
