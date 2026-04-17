import { type ReactNode } from "react";
import { motion } from "framer-motion";
import type { ViewportTransform } from "@scenar/core";

interface ViewportTransformLayerProps {
  children: ReactNode;
  transform: ViewportTransform;
}

const ZOOM_SPRING = {
  type: "spring",
  stiffness: 100,
  damping: 20,
  mass: 0.8,
} as const;

/**
 * Animated transform layer for viewport zoom/pan transitions.
 *
 * Wraps demo content in a Framer Motion container that smoothly
 * animates `scale` + `translate` to zoom into or pan across regions
 * of the demo. Uses `transformOrigin: "0 0"` so scale and translate
 * compose predictably.
 *
 * When `scale !== 1`, applies `overflow: hidden` to clip the
 * zoomed content to the viewport bounds. At identity transform
 * overflow is unrestricted so portaled content is not clipped.
 *
 * **Critical invariant**: The `Cursor` component must be a sibling
 * of this layer, NOT a child. The cursor uses `position: absolute`
 * relative to the shared container.
 */
export function ViewportTransformLayer({ children, transform }: ViewportTransformLayerProps) {
  const isZoomed = transform.scale !== 1 || transform.x !== 0 || transform.y !== 0;

  return (
    <div className={isZoomed ? "overflow-hidden" : undefined}>
      <motion.div
        animate={{ scale: transform.scale, x: transform.x, y: transform.y }}
        transition={ZOOM_SPRING}
        style={{ transformOrigin: "0 0" }}
      >
        {children}
      </motion.div>
    </div>
  );
}
