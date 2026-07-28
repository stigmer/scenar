import {
  type ComponentType,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import {
  type NarrationManifest,
  type ScenarioShot,
  type ScenarioStep,
  type StepTimeline,
  VIEWPORT_TRANSFORM_IDENTITY,
  collectScenarioShots,
  computeStepTimeline,
} from "@scenar/core";
import { TimeSourceProvider } from "../time/TimeSource.js";
import { VideoExportProvider } from "../video/VideoExportContext.js";
import { ScenarioPlayer } from "../player/ScenarioPlayer.js";
import { ViewportTransformLayer } from "../viewport/ViewportTransformLayer.js";
import { ScenarioStage } from "../stage/ScenarioStage.js";
import { useStepInteractions } from "../interactions/useStepInteractions.js";

/**
 * Marker attribute on the capture frame — the element `scenar shoot`
 * screenshots. Exposed to drivers via {@link ScenarioCaptureDriver.frameSelector}
 * so the CLI never hard-codes it.
 */
const SHOT_FRAME_ATTRIBUTE = "data-scenar-shot-frame";

/** CSS selector for the capture frame element. */
export const SHOT_FRAME_SELECTOR = `[${SHOT_FRAME_ATTRIBUTE}]`;

/**
 * One frame-like tick of the capture walk (~30fps), mirroring the
 * Remotion render model the TimeSource path was built for.
 */
const TICK_MS = 33;

/**
 * The external control surface a capture session drives. The packed
 * entry's `?shot` branch installs this on `window.__scenarShot`; the
 * `scenar shoot` command consumes it through the page.
 */
export interface ScenarioCaptureDriver {
  /** Every declared shot, resolved to timeline order (validated). */
  readonly shots: readonly ScenarioShot[];
  readonly timeline: StepTimeline;
  /** Selector for the element to screenshot. */
  readonly frameSelector: string;
  /**
   * Jump the TimeSource directly to `ms` — a cold jump with no history.
   * Cold jumps DROP cross-step React state created by earlier steps'
   * interactions (spike-proven: a click-created list item and typed input
   * text vanish), so this exists for diagnostics and tests, never for
   * capture. Use {@link walkTo}.
   */
  readonly setTime: (ms: number) => void;
  /**
   * Advance the TimeSource from its current value to `ms` in sequential
   * {@link TICK_MS} ticks, flushing a render per tick so every interaction
   * fires in timeline order — the same "frames render in timeline order"
   * assumption the video-export path documents. Resolves after paint
   * settles. Never walks backwards; capture visits shots in timeline order.
   */
  readonly walkTo: (ms: number) => Promise<void>;
}

export interface ScenarioCaptureMountProps<T> {
  /** Scenario id, passed through as the player's bundle id. */
  scenarioId: string;
  steps: readonly ScenarioStep<T>[];
  renderStep: (data: T, stepIndex: number) => ReactNode;
  /** Canonical viewport width in px — the frame renders at exactly this width. */
  canonicalWidth: number;
  /** Shell height in px, exposed as `--scenar-shell-height`. */
  shellHeight: number;
  /**
   * Narration manifest, when the scenario has one. Step durations (and
   * therefore shot times and interaction timing) are narration-driven, so
   * the caller must resolve the manifest BEFORE mounting — a capture
   * without it would walk a different timeline than playback and shoot
   * every frame at the wrong moment.
   */
  narrationManifest?: NarrationManifest;
  /** Wrap each step's content in `<ScenarioStage>` (staged bundles). */
  stage?: boolean;
  /** The scenario's PreviewProviders, when it has any. */
  providers?: ComponentType<{ children: ReactNode }>;
  /** Receives the driver once the tree is mounted and shots are validated. */
  onReady: (driver: ScenarioCaptureDriver) => void;
  /** Receives shot-declaration errors (invalid or duplicate names). */
  onError: (error: Error) => void;
}

/**
 * The capture tree behind `scenar shoot` — DD-02's "`?shot=` catch-up
 * mount". Renders the same scenario tree the packed embed plays, but under
 * a `TimeSourceProvider` + `VideoExportProvider` so time is externally
 * driven, exactly as the Remotion export path works. No wall-clock timer
 * ever runs: `useStepProgression` and `useStepInteractions` both switch to
 * their frame-driven paths whenever a TimeSource is present.
 *
 * Determinism notes carried from the 2026-07-28 spike (all load-bearing):
 *
 * - The interaction wiring renders BELOW the provider (see
 *   {@link CaptureHarness}) — hoisting `useStepInteractions` above it
 *   silently selects the wall-clock browser path.
 * - `DemoViewport` is a passthrough under `isVideoExport`, so this mount
 *   owns its geometry: canonical width plus the `--scenar-shell-height`
 *   variable the shells consume.
 * - No `<Cursor>` renders: a still shows a screen, not a pointer, and the
 *   cursor's framer-motion spring is the engine's only measured
 *   nondeterminism (DD-02 D3).
 * - Frames are visited by a sequential walk, never a cold jump — see
 *   {@link ScenarioCaptureDriver.walkTo}.
 */
export function ScenarioCaptureMount<T>({
  scenarioId,
  steps,
  renderStep,
  canonicalWidth,
  shellHeight,
  narrationManifest,
  stage = false,
  providers: Providers,
  onReady,
  onError,
}: ScenarioCaptureMountProps<T>) {
  const [timeMs, setTimeMs] = useState(0);
  const timeRef = useRef(0);
  timeRef.current = timeMs;

  const timeline = useMemo(
    () => computeStepTimeline(steps, narrationManifest ?? null),
    [steps, narrationManifest],
  );

  // Install the driver once. A capture mount's inputs are frozen for the
  // session by contract — the CLI mounts, walks, screenshots, and closes
  // the page; nothing re-renders the mount with new steps.
  const installedRef = useRef(false);
  useEffect(() => {
    if (installedRef.current) return;
    installedRef.current = true;

    let shots: ScenarioShot[];
    try {
      shots = collectScenarioShots(steps, timeline);
    } catch (error) {
      onError(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    const settle = () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 30)));
      });

    onReady({
      shots,
      timeline,
      frameSelector: SHOT_FRAME_SELECTOR,
      setTime: (ms: number) => flushSync(() => setTimeMs(ms)),
      walkTo: async (ms: number) => {
        // flushSync per tick renders synchronously; React flushes the
        // previous tick's passive effects (where interactions fire) at the
        // start of the next flush, so ticks preserve timeline order.
        for (let t = timeRef.current + TICK_MS; t < ms; t += TICK_MS) {
          flushSync(() => setTimeMs(t));
        }
        flushSync(() => setTimeMs(ms));
        // An empty flush forces the final tick's passive effects to land.
        flushSync(() => {});
        await settle();
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run-once by design (see above)
  }, []);

  const harness = (
    <CaptureHarness
      scenarioId={scenarioId}
      steps={steps}
      renderStep={renderStep}
      canonicalWidth={canonicalWidth}
      shellHeight={shellHeight}
      narrationManifest={narrationManifest}
      stage={stage}
    />
  );

  return (
    <TimeSourceProvider currentTimeMs={timeMs} stepStartTimesMs={timeline.stepStartTimesMs}>
      <VideoExportProvider>
        {Providers ? <Providers>{harness}</Providers> : harness}
      </VideoExportProvider>
    </TimeSourceProvider>
  );
}

interface CaptureHarnessProps<T> {
  scenarioId: string;
  steps: readonly ScenarioStep<T>[];
  renderStep: (data: T, stepIndex: number) => ReactNode;
  canonicalWidth: number;
  shellHeight: number;
  narrationManifest?: NarrationManifest;
  stage: boolean;
}

/**
 * Everything that consumes the TimeSource — including the
 * `useStepInteractions` call site — must render below the provider, or
 * the hook silently selects the wall-clock browser path (the spike's
 * stage-1 run 1 was 10/13 until the tree was split exactly like this).
 * That is this component's whole reason to exist as a separate function.
 */
function CaptureHarness<T>({
  scenarioId,
  steps,
  renderStep,
  canonicalWidth,
  shellHeight,
  narrationManifest,
  stage,
}: CaptureHarnessProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const [stepIndex, setStepIndex] = useState(0);
  // Cursor state is still wired — interactions call these setters — but no
  // <Cursor> consumes it: a still shows a screen, not a pointer (D3).
  const [, setCursorTarget] = useState<string | undefined>(undefined);
  const [, setShowRipple] = useState(true);
  const [, setDragging] = useState(false);
  const [viewport, setViewport] = useState(VIEWPORT_TRANSFORM_IDENTITY);

  const handleStepChange = useCallback((_data: T, index: number) => {
    setStepIndex(index);
    setCursorTarget(undefined);
  }, []);

  useStepInteractions({
    stepIndex,
    narrationManifest,
    containerRef,
    cameraRef,
    setCursorTarget,
    setShowRipple,
    setDragging,
    setViewportTransform: setViewport,
    steps: steps as ScenarioStep<T>[],
  });

  const bundle = useMemo(
    () => ({ id: scenarioId, steps: steps as ScenarioStep<T>[], narrationManifest }),
    [scenarioId, steps, narrationManifest],
  );

  return (
    <div
      {...{ [SHOT_FRAME_ATTRIBUTE]: "" }}
      ref={containerRef}
      style={
        {
          width: canonicalWidth,
          position: "relative",
          overflow: "hidden",
          "--scenar-shell-height": `${shellHeight}px`,
        } as React.CSSProperties
      }
    >
      <ViewportTransformLayer transform={viewport} contentRef={cameraRef}>
        <ScenarioPlayer bundle={bundle} onStepChange={handleStepChange}>
          {stage
            ? (data: T, i: number) => <ScenarioStage>{renderStep(data, i)}</ScenarioStage>
            : renderStep}
        </ScenarioPlayer>
      </ViewportTransformLayer>
    </div>
  );
}
