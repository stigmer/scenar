import { type ReactNode, useMemo } from "react";
import {
  Audio,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  type ScenarioBundle,
  type SfxSound,
  computeMusicEnvelope,
  deriveSfxTimeline,
  musicGainAt,
} from "@scenar/core";
import {
  type PresenterMediaRenderer,
  TimeSourceProvider,
  VideoExportProvider,
  ScenarioPlayer,
} from "@scenar/react";
import { PresentationStack, type RenderViewport } from "./PresentationStack.js";
import { msToFrames, useScenarioTimeline } from "./useScenarioTimeline.js";

const DEFAULT_FPS = 30;

/**
 * Frame window an SFX `<Sequence>` stays mounted. Comfortably longer than
 * the ~35 ms synthesized ticks (plus MP3 encoder padding), short enough
 * that rapid typing never accumulates hundreds of live audio tags.
 */
const SFX_WINDOW_MS = 500;

/**
 * Default staged locations of the built-in SFX set, mirroring where
 * `scenar render` stages `@scenar/react`'s assets in the public dir.
 * Resolved through the same `staticFile` path as every other audio src.
 */
const DEFAULT_SFX_SRCS: Record<SfxSound, string> = {
  click: "soundtrack/sfx/click.mp3",
  keystroke: "soundtrack/sfx/keystroke.mp3",
};

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
  /**
   * Burn step captions into the video: each step's `narration` text
   * renders as a subtitle-style overlay. Forwarded to `ScenarioPlayer` —
   * the same overlay the interactive embed shows, so both outputs caption
   * identically. Defaults to false.
   */
  captions?: boolean;
  /**
   * Asset paths for the built-in SFX set when `bundle.soundtrack.sfx` is
   * enabled, resolved like every other audio src (through `staticFile`
   * when `useStaticFile` is on). Defaults to the locations `scenar
   * render` stages them at (`soundtrack/sfx/<name>.mp3`).
   */
  sfxSrcs?: Record<SfxSound, string>;
  /**
   * Mount the full presentation stack around the player — the same stack
   * packed embeds mount: a definite canonical box contain-fit into the
   * video frame (the geometry `DemoViewport` provides in browsers but
   * deliberately passes through under `isVideoExport`), the
   * `ViewportTransformLayer` camera, the `Cursor`, and TimeSource-driven
   * step interactions. Without it, only step content renders:
   * interactions' visible effects are absent from the MP4 and surfaces
   * that size through the shell-geometry contract
   * (`--scenar-shell-height`) collapse (scenar#35). Omitted, the
   * composition keeps its prior bare-player output.
   */
  viewport?: RenderViewport;
  /**
   * Wrap each step's content in `<ScenarioStage>` (staged bundles — the
   * `scenar pack --stage` presentation). Only meaningful with `viewport`.
   */
  stage?: boolean;
  /**
   * Render the cursor overlay for interactions. Defaults to true; only
   * meaningful with `viewport`.
   */
  cursor?: boolean;
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
  captions = false,
  sfxSrcs = DEFAULT_SFX_SRCS,
  viewport,
  stage = false,
  cursor = true,
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

  // Synthesized card steps may carry a logo asset. Like every audio src,
  // the authored path (e.g. "./logo.png") points at a file `scenar render`
  // stages into the public dir, so it resolves through the same
  // staticFile path before the player renders it.
  const playerBundle = useMemo(() => {
    if (!bundle.steps.some((step) => step.card?.logoSrc)) return bundle;
    return {
      ...bundle,
      steps: bundle.steps.map((step) =>
        step.card?.logoSrc
          ? {
              ...step,
              card: {
                ...step.card,
                logoSrc: resolveAssetSrc(step.card.logoSrc, useStaticFileProp),
              },
            }
          : step,
      ),
    };
  }, [bundle, useStaticFileProp]);

  const soundtrack = bundle.soundtrack;

  // Music level per frame — the same pure @scenar/core envelope the
  // browser player automates through its gain node, evaluated here as a
  // Remotion volume function so both outputs duck identically.
  const musicEnvelope = useMemo(
    () =>
      soundtrack?.musicSrc
        ? computeMusicEnvelope(bundle.steps, bundle.narrationManifest, soundtrack)
        : null,
    [soundtrack, bundle.steps, bundle.narrationManifest],
  );
  const musicVolume = useMemo(
    () =>
      musicEnvelope
        ? (f: number) => musicGainAt(musicEnvelope, (f / fps) * 1000)
        : undefined,
    [musicEnvelope, fps],
  );

  // The presenter media slot for the export time domain (T02 decision
  // G2-5): the player owns the PiP frame and its fade; this renderer
  // fills the frame with a frame-locked clip. `layout="none"` nests the
  // Sequence inside the player's DOM without an absolute-fill wrapper;
  // `from` is composition-absolute because the player tree sits outside
  // any other Sequence. Muted — narration remains the only audio.
  const presenterMedia = useMemo<PresenterMediaRenderer | undefined>(() => {
    if (!bundle.presenterManifest) return undefined;
    const renderer: PresenterMediaRenderer = ({ src, window: clipWindow }) => (
      <Sequence
        layout="none"
        from={msToFrames(clipWindow.startMs, fps)}
        durationInFrames={Math.max(1, msToFrames(clipWindow.clipDurationMs, fps))}
      >
        <OffthreadVideo
          muted
          src={resolveAssetSrc(src, useStaticFileProp)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </Sequence>
    );
    return renderer;
  }, [bundle.presenterManifest, fps, useStaticFileProp]);

  // Derived SFX events converted from step-relative offsets to absolute
  // frames via the shared step starts — the export-side consumer of the
  // same `deriveSfxTimeline` the browser scheduler plays.
  const sfxClips = useMemo(() => {
    if (soundtrack?.sfx !== true) return [];
    return deriveSfxTimeline(bundle.steps, bundle.narrationManifest).map(
      (event, index) => ({
        key: `sfx-${index}`,
        startFrame: msToFrames(
          (timeline.stepStartTimesMs[event.stepIndex] ?? 0) + event.offsetMs,
          fps,
        ),
        src: sfxSrcs[event.sound],
      }),
    );
  }, [soundtrack, bundle.steps, bundle.narrationManifest, timeline, fps, sfxSrcs]);

  return (
    <>
      <TimeSourceProvider
        currentTimeMs={currentTimeMs}
        stepStartTimesMs={timeline.stepStartTimesMs}
      >
        <VideoExportProvider presenterMedia={presenterMedia}>
          {viewport ? (
            // The full presentation stack (scenar#35). Rendered below the
            // TimeSourceProvider on purpose: its useStepInteractions call
            // must see the time source or it silently selects the
            // wall-clock browser scheduler (the capture mount's lesson).
            <PresentationStack
              bundle={playerBundle}
              captions={captions}
              viewport={viewport}
              stage={stage}
              cursor={cursor}
            >
              {children}
            </PresentationStack>
          ) : (
            <ScenarioPlayer bundle={playerBundle} captions={captions}>
              {children}
            </ScenarioPlayer>
          )}
        </VideoExportProvider>
      </TimeSourceProvider>

      {timeline.audioClips.map((clip) => (
        <Sequence
          key={clip.stepIndex}
          from={clip.startFrame}
          durationInFrames={clip.durationFrames}
        >
          <Audio src={resolveAssetSrc(clip.src, useStaticFileProp)} />
        </Sequence>
      ))}

      {soundtrack?.musicSrc && (
        // The music spans the whole composition: `loop` folds a shorter
        // asset seamlessly; the volume function carries fade-in, ducking,
        // and the closing fade-out, so no trim math is needed here.
        <Audio
          loop
          src={resolveAssetSrc(soundtrack.musicSrc, useStaticFileProp)}
          volume={musicVolume}
        />
      )}

      {sfxClips.map((clip) => (
        <Sequence
          key={clip.key}
          from={clip.startFrame}
          durationInFrames={msToFrames(SFX_WINDOW_MS, fps)}
        >
          <Audio src={resolveAssetSrc(clip.src, useStaticFileProp)} />
        </Sequence>
      ))}
    </>
  );
}

/**
 * Resolve a staged asset URL (audio clips, card logos).  When
 * `useStaticFile` is true, paths are resolved through Remotion's
 * `staticFile()`, stripping a leading `/` (Stigmer's original pattern)
 * or `./` (the form `scenar narrate`, soundtrack, and title-card
 * configs write) so the path lands inside the staged public dir.
 */
function resolveAssetSrc(src: string, useStaticFileFn: boolean): string {
  if (useStaticFileFn) {
    return staticFile(src.replace(/^(\.\/|\/)/, ""));
  }
  return src;
}
