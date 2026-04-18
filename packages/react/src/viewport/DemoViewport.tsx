import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { useVideoExport } from "../video/VideoExportContext.js";

/** Default canonical width for the virtual viewport (pixels). */
const DEFAULT_CANONICAL_WIDTH = 896;

/** Default minimum zoom level to prevent the viewport from becoming too small. */
const DEFAULT_MIN_ZOOM = 0.5;

/** Default CSS classes applied to the viewport wrapper. */
const DEFAULT_WRAPPER_CLASS = "relative mx-auto max-w-4xl overflow-hidden";

interface DemoViewportProps {
  /**
   * Ref applied to the canonical-size inner div. Scenarios pass
   * this same ref to `<Cursor>` and `useStepInteractions` so that
   * cursor positions and scroll queries resolve against stable
   * internal dimensions.
   */
  containerRef?: RefObject<HTMLDivElement | null>;
  children: ReactNode;
  className?: string;
  /** Canonical width in pixels. Children render at this width, CSS zoom fits the container. */
  canonicalWidth?: number;
  /** Minimum zoom level (0–1). Prevents the viewport from shrinking below this. */
  minZoom?: number;
  /** Shell height in pixels, exposed as `--scenar-shell-height` CSS variable. */
  shellHeight?: number;
  /** CSS classes for the outer wrapper. Overrides the default layout classes. */
  wrapperClassName?: string;
}

/**
 * Fixed virtual viewport for interactive demos.
 *
 * Renders children at a canonical pixel width and applies CSS `zoom`
 * to scale into the available page width. This guarantees that cursor
 * positions, scroll offsets, and interaction targets are computed
 * against stable internal dimensions regardless of the browser viewport.
 *
 * In video-export mode the component is a transparent passthrough —
 * the Remotion composition owns viewport sizing.
 */
export function DemoViewport({
  containerRef,
  children,
  className,
  canonicalWidth = DEFAULT_CANONICAL_WIDTH,
  minZoom = DEFAULT_MIN_ZOOM,
  shellHeight,
  wrapperClassName = DEFAULT_WRAPPER_CLASS,
}: DemoViewportProps) {
  const { isVideoExport } = useVideoExport();
  const outerRef = useRef<HTMLDivElement>(null);
  const internalRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  const innerRef = containerRef ?? internalRef;

  useEffect(() => {
    if (isVideoExport) return;
    const outer = outerRef.current;
    if (!outer) return;

    const update = (entries: ResizeObserverEntry[]) => {
      const width = entries[0]!.contentRect.width;
      setZoom(Math.max(Math.min(width / canonicalWidth, 1), minZoom));
    };

    const ro = new ResizeObserver(update);
    ro.observe(outer);
    return () => ro.disconnect();
  }, [isVideoExport, canonicalWidth, minZoom]);

  const classes = className ? `${wrapperClassName} ${className}` : wrapperClassName;

  if (isVideoExport) {
    return (
      <div ref={innerRef} className={classes}>
        {children}
      </div>
    );
  }

  const style: React.CSSProperties & Record<string, string | number> = {
    width: canonicalWidth,
    zoom,
  };
  if (shellHeight != null) {
    style["--scenar-shell-height"] = `${shellHeight}px`;
  }

  return (
    <div ref={outerRef} className={classes}>
      <div ref={innerRef} className="relative" style={style}>
        {children}
      </div>
    </div>
  );
}
