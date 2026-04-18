import { type ReactNode } from "react";
import {
  Audio,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { ScenarioBundle } from "@scenar/core";
import { TimeSourceProvider, VideoExportProvider, ScenarioPlayer } from "@scenar/react";
import { useScenarioTimeline, type AudioClip } from "./useScenarioTimeline.js";

const DEFAULT_FPS = 30;

interface ScenarioCompositionProps<T> {
  /** Self-contained scenario bundle with steps and optional narration. */
  bundle: ScenarioBundle<T>;
  /** Render function — receives current step data and step index. */
  children: (data: T, stepIndex: number) => ReactNode;
  /** Frames per second.  Defaults to 30. */
  fps?: number;
  /**
   * When true, audio `src` paths are resolved through Remotion's
   * `staticFile()` (stripping a leading `/`).  Enable this when audio
   * files live in the Remotion project's `public/` directory.
   * Defaults to true.
   */
  useStaticFile?: boolean;
}

/**
 * Root component for rendering a Scenar scenario as a Remotion video.
 *
 * Wraps the scenario in the correct providers (`VideoExportProvider`,
 * `TimeSourceProvider`) and maps Remotion frames to the Scenar
 * timeline.  Narration audio clips from the bundle manifest are placed
 * as `<Audio>` elements at the exact frame offsets computed by the
 * timeline — bypassing ScenarioPlayer's browser `<audio>` element
 * entirely.
 *
 * Ported from Stigmer's `video/compositions/DemoVideo.tsx` with the
 * product-specific parts (registry, AppShell, Tailwind classes)
 * factored out.  The consumer wraps this component in their own
 * `<AbsoluteFill>` with whatever layout they need.
 *
 * Usage inside a Remotion project:
 *
 * ```tsx
 * import { Composition, AbsoluteFill } from "remotion";
 * import { ScenarioComposition, calculateScenarioTimeline } from "@scenar/remotion";
 *
 * export const RemotionRoot = () => (
 *   <Composition
 *     id="my-demo"
 *     component={() => (
 *       <AbsoluteFill>
 *         <ScenarioComposition bundle={myBundle}>
 *           {(data) => <MyScenarioView data={data} />}
 *         </ScenarioComposition>
 *       </AbsoluteFill>
 *     )}
 *     fps={30}
 *     width={1920}
 *     height={1080}
 *     durationInFrames={
 *       calculateScenarioTimeline(myBundle.steps, myBundle.narrationManifest, 30)
 *         .durationInFrames
 *     }
 *   />
 * );
 * ```
 */
export function ScenarioComposition<T>({
  bundle,
  children,
  fps: fpsProp,
  useStaticFile: useStaticFileProp = true,
}: ScenarioCompositionProps<T>) {
  const videoConfig = useVideoConfig();
  const fps = fpsProp ?? videoConfig.fps ?? DEFAULT_FPS;
  const frame = useCurrentFrame();

  const timeline = useScenarioTimeline(
    bundle.steps,
    bundle.narrationManifest,
    fps,
  );

  const currentTimeMs = (frame / fps) * 1000;

  return (
    <>
      <TimeSourceProvider
        currentTimeMs={currentTimeMs}
        stepStartTimesMs={timeline.stepStartTimesMs}
      >
        <VideoExportProvider>
          <ScenarioPlayer bundle={bundle}>
            {children}
          </ScenarioPlayer>
        </VideoExportProvider>
      </TimeSourceProvider>

      {timeline.audioClips.map((clip) => (
        <Sequence
          key={clip.stepIndex}
          from={clip.startFrame}
          durationInFrames={clip.durationFrames}
        >
          <Audio src={resolveAudioSrc(clip, useStaticFileProp)} />
        </Sequence>
      ))}
    </>
  );
}

/**
 * Resolve audio source URL.  When `useStaticFile` is true, paths are
 * resolved through Remotion's `staticFile()` (strips leading `/`).
 * This matches Stigmer's pattern: `staticFile(clip.src.replace(/^\//, ""))`.
 */
function resolveAudioSrc(clip: AudioClip, useStaticFileFn: boolean): string {
  if (useStaticFileFn) {
    return staticFile(clip.src.replace(/^\//, ""));
  }
  return clip.src;
}
