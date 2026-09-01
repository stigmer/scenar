import { type ReactNode, useCallback, useRef, useState } from "react";
import { useVideoConfig } from "remotion";
import {
  type NarrationManifest,
  type ScenarioBundle,
  VIEWPORT_TRANSFORM_IDENTITY,
} from "@scenar/core";
import {
  Cursor,
  ScenarioPlayer,
  ScenarioStage,
  ViewportTransformLayer,
  useStepInteractions,
} from "@scenar/react";

/**
 * The canonical viewport a scenario lays out at inside the video frame.
 * Mirrors the embed's `ScenarEmbedViewport` vocabulary (`widthPx` /
 * `heightPx`) — the same numbers a bundle would announce over the embed
 * handshake.
 */
export interface RenderViewport {
  readonly widthPx: number;
  readonly heightPx: number;
}

/**
 * The contain-fit placement of a canonical box inside a video frame: one
 * uniform scale factor (the DD-008 rule — the frame boundary owns the only
 * scale), centered with letterbox/pillarbox margins on the shorter axis.
 * Exported for tests.
 */
export function computeContainFit(
  frameWidth: number,
  frameHeight: number,
  boxWidth: number,
  boxHeight: number,
): { scale: number; offsetX: number; offsetY: number } {
  const scale = Math.min(frameWidth / boxWidth, frameHeight / boxHeight);
  return {
    scale,
    offsetX: (frameWidth - boxWidth * scale) / 2,
    offsetY: (frameHeight - boxHeight * scale) / 2,
  };
}

interface PresentationStackProps<T> {
  /** The applied bundle (cards synthesized) the player renders. */
  bundle: ScenarioBundle<T> & { narrationManifest?: NarrationManifest };
  captions: boolean;
  viewport: RenderViewport;
  /** Wrap each step's content in `<ScenarioStage>` (staged bundles). */
  stage: boolean;
  /** Render the cursor overlay for interactions. */
  cursor: boolean;
  children: (data: T, stepIndex: number) => ReactNode;
}

/**
 * The full presentation stack for the video-export path — the same stack
 * the packed embed entry mounts around the player (scenar#35), assembled
 * from the pieces that are already frame-driven under a TimeSource:
 *
 *   fixed canonical box (geometry the embed's DemoViewport provides)
 *     └ ViewportTransformLayer(camera — its export path interpolates
 *       per frame with `interpolateViewportTransform`)
 *         └ ScenarioPlayer
 *         └ Cursor              ← child of the camera, so it scales and
 *                                 pans with the content under a zoom
 *   + useStepInteractions       ← switches to the frame-driven scheduler
 *                                 whenever a TimeSource is present
 *
 * Geometry: `DemoViewport` is deliberately a passthrough under
 * `isVideoExport` (see ScenarioCaptureMount), so this stack owns it — a
 * definite canonical box (`viewport.widthPx` × `heightPx`) exposing the
 * `--scenar-shell-height` variable the shells consume, contain-fit into
 * the composition frame with exactly one scale factor (DD-008). Without a
 * definite box, surfaces that size through the shell-geometry contract
 * collapse to zero height — the scenar#35 black frames.
 *
 * Interaction state assumes frames render in timeline order — the same
 * sequential model `ScenarioCaptureMount.walkTo` documents. The render
 * pipeline enforces it by rendering with concurrency 1.
 *
 * Must render below the composition's `TimeSourceProvider`, or
 * `useStepInteractions` silently selects the wall-clock browser path
 * (the capture mount's load-bearing lesson).
 */
export function PresentationStack<T>({
  bundle,
  captions,
  viewport,
  stage,
  cursor,
  children,
}: PresentationStackProps<T>) {
  const { width: frameWidth, height: frameHeight } = useVideoConfig();
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [cursorTarget, setCursorTarget] = useState<string | undefined>(undefined);
  const [showRipple, setShowRipple] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [cameraTransform, setCameraTransform] = useState(VIEWPORT_TRANSFORM_IDENTITY);

  // Reset the cursor when the step changes so a prior step's target never
  // lingers; the new step's interactions re-set it at their scheduled time.
  // One handler feeds both step-change callbacks: authored steps deliver
  // data, card steps deliver the card — the wiring needs only the index,
  // and it must track BOTH so card-step interactions (the outro's
  // cursor-clear and viewport-reset housekeeping) reach the scheduler.
  // Mirrors the packed embed entry's handler exactly, so the two outputs
  // cannot diverge on cursor semantics.
  const handleStepChange = useCallback((_dataOrCard: unknown, index: number) => {
    setStepIndex(index);
    setCursorTarget(undefined);
  }, []);

  useStepInteractions({
    stepIndex,
    narrationManifest: bundle.narrationManifest,
    containerRef,
    cameraRef,
    setCursorTarget,
    setShowRipple,
    setDragging,
    setViewportTransform: setCameraTransform,
    steps: bundle.steps,
  });

  const fit = computeContainFit(
    frameWidth,
    frameHeight,
    viewport.widthPx,
    viewport.heightPx,
  );

  return (
    // The letterbox/pillarbox canvas: painted with the theme surface token
    // so uncovered margins read as an intentional page, not dead pixels.
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--scenar-surface)",
      }}
    >
      {/* The canonical box, contain-fit into the frame. `transform` does
          not affect layout, so the box is positioned at its scaled offset
          and scaled from its top-left corner — one scale factor, owned by
          this boundary. */}
      <div
        ref={containerRef}
        style={
          {
            position: "absolute",
            left: fit.offsetX,
            top: fit.offsetY,
            width: viewport.widthPx,
            height: viewport.heightPx,
            transform: `scale(${fit.scale})`,
            transformOrigin: "top left",
            overflow: "hidden",
            "--scenar-shell-height": `${viewport.heightPx}px`,
          } as React.CSSProperties
        }
      >
        <ViewportTransformLayer transform={cameraTransform} contentRef={cameraRef}>
          <ScenarioPlayer
            bundle={bundle}
            captions={captions}
            onStepChange={handleStepChange}
            onCardStepChange={handleStepChange}
          >
            {stage
              ? (data: T, i: number) => <ScenarioStage>{children(data, i)}</ScenarioStage>
              : children}
          </ScenarioPlayer>
          {cursor && (
            <Cursor
              target={cursorTarget}
              containerRef={cameraRef}
              showRipple={showRipple}
              isDragging={dragging}
            />
          )}
        </ViewportTransformLayer>
      </div>
    </div>
  );
}
