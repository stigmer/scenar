import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  CAMERA_TRANSITION_MS,
  VIEWPORT_TRANSFORM_IDENTITY,
  type ViewportCameraMove,
  type ViewportTransform,
  cameraEase,
  interpolateViewportTransform,
} from "@scenar/core";
import { useTimeSource } from "../time/TimeSource.js";
import { useVideoExport } from "../video/VideoExportContext.js";

interface ViewportTransformLayerProps {
  children: ReactNode;
  /** The camera's target transform; changes tween over `CAMERA_TRANSITION_MS`. */
  transform: ViewportTransform;
  /**
   * Ref attached to the transformed content element — the camera's canonical
   * coordinate space. Pass the same ref to `<Cursor containerRef>` (rendered
   * as a *child* of this layer) and to `useStepInteractions`' `cameraRef` so
   * cursor positions and `viewport_transition` target math resolve in
   * canonical coordinates at any camera state, including mid-move.
   */
  contentRef?: RefObject<HTMLDivElement | null>;
}

function isIdentity(t: ViewportTransform): boolean {
  return (
    t.scale === VIEWPORT_TRANSFORM_IDENTITY.scale &&
    t.x === VIEWPORT_TRANSFORM_IDENTITY.x &&
    t.y === VIEWPORT_TRANSFORM_IDENTITY.y
  );
}

function transformsEqual(a: ViewportTransform, b: ViewportTransform): boolean {
  return a.scale === b.scale && a.x === b.x && a.y === b.y;
}

/**
 * The camera: an animated transform layer for viewport zoom/pan moves.
 *
 * A camera move is a fixed tween — `cameraEase` (ease-out quint, never
 * overshoots) over exactly `CAMERA_TRANSITION_MS` — not a spring, so both
 * output paths derive the identical visual: browser playback hands the same
 * curve and duration to Framer Motion, and video export computes the exact
 * intermediate transform per frame with `interpolateViewportTransform` from
 * the frame-driven time source. One curve, two time domains, zero drift.
 *
 * Uses `transformOrigin: "0 0"` so scale and translate compose predictably,
 * and clips overflow while the camera is away from its rest identity (at
 * rest overflow is unrestricted so portaled content is not clipped).
 *
 * **Cursor placement**: render `<Cursor>` as a *child* of this layer (after
 * the scenario content), with the shared `contentRef` as its container. The
 * pointer then scales and pans with the content — exactly what a recorded
 * cursor does under a camera zoom — and because cursor position math divides
 * by the container's measured scale, its canonical coordinates stay correct
 * at any camera state. (This inverts the former "cursor must be a sibling"
 * rule, which existed only because position math predated the camera.)
 */
export function ViewportTransformLayer({
  children,
  transform,
  contentRef,
}: ViewportTransformLayerProps) {
  const { isVideoExport } = useVideoExport();
  const timeSource = useTimeSource();

  // --- Export path: a per-frame interpolated static transform. -------------
  // The move (from → to, fired at atTimeMs) is retargeted whenever the
  // `transform` prop changes, starting from wherever the camera visually is
  // at that instant — matching how the browser tween handles interruption.
  // Frames are assumed to render in timeline order within a render worker,
  // the same sequential model every other interaction effect relies on.
  const nowMs = timeSource?.currentTimeMs ?? 0;
  const moveRef = useRef<ViewportCameraMove>({
    from: transform,
    to: transform,
    atTimeMs: 0,
  });
  if (isVideoExport && !transformsEqual(transform, moveRef.current.to)) {
    const progress = (nowMs - moveRef.current.atTimeMs) / CAMERA_TRANSITION_MS;
    moveRef.current = {
      from: interpolateViewportTransform(
        moveRef.current.from,
        moveRef.current.to,
        progress,
      ),
      to: transform,
      atTimeMs: nowMs,
    };
  }

  // --- Browser path: clip while the camera is in flight or off identity. ---
  const [animating, setAnimating] = useState(false);
  useEffect(() => {
    if (!isVideoExport) setAnimating(true);
  }, [isVideoExport, transform.scale, transform.x, transform.y]);

  if (isVideoExport) {
    const rendered = interpolateViewportTransform(
      moveRef.current.from,
      moveRef.current.to,
      (nowMs - moveRef.current.atTimeMs) / CAMERA_TRANSITION_MS,
    );
    return (
      <div className={isIdentity(rendered) ? undefined : "overflow-hidden"}>
        <div
          ref={contentRef}
          style={{
            position: "relative",
            transformOrigin: "0 0",
            transform: `translate(${rendered.x}px, ${rendered.y}px) scale(${rendered.scale})`,
          }}
        >
          {children}
        </div>
      </div>
    );
  }

  const clip = !isIdentity(transform) || animating;
  return (
    <div className={clip ? "overflow-hidden" : undefined}>
      <motion.div
        ref={contentRef}
        animate={{ scale: transform.scale, x: transform.x, y: transform.y }}
        transition={{ duration: CAMERA_TRANSITION_MS / 1000, ease: cameraEase }}
        onAnimationComplete={() => setAnimating(false)}
        style={{ position: "relative", transformOrigin: "0 0" }}
      >
        {children}
      </motion.div>
    </div>
  );
}
