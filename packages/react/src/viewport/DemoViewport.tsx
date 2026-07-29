import { type ReactNode, type RefObject, useLayoutEffect, useRef, useState } from "react";
import { useVideoExport } from "../video/VideoExportContext.js";
import { ViewportChromeProvider } from "./ViewportChrome.js";

/** Default canonical width for the virtual viewport (pixels). */
const DEFAULT_CANONICAL_WIDTH = 896;

/**
 * Default minimum zoom level.
 *
 * Zero: on containers narrower than the canonical width, content scales all
 * the way down and stays complete. Any positive floor combines with the
 * wrapper's `overflow-hidden` to silently crop the right edge (a 0.5 floor
 * clipped ~16% of every 896-canonical tour on a 375px phone, with no
 * scrollbar and no affordance). Smaller-but-complete beats hidden. Callers
 * who prefer a floor can still pass `minZoom`.
 */
const DEFAULT_MIN_ZOOM = 0;

/**
 * Default CSS classes applied to the viewport wrapper.
 *
 * Deliberately carries no `max-w-*` class: the wrapper's width cap must track
 * `canonicalWidth` (applied as an inline style below), because zoom is capped
 * at 1 and content never lays out wider than canonical — a wrapper wider than
 * canonical only centers. A hardcoded class cap (the former `max-w-4xl`,
 * a 896px twin of the default canonical width) silently pinned zoom at
 * `896 / canonicalWidth` for any larger canonical width.
 */
const DEFAULT_WRAPPER_CLASS = "relative mx-auto overflow-hidden";

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
 * Also provides the **chrome layer** (see `ViewportChrome.tsx`): an
 * unscaled overlay covering the visual content box, into which
 * `ScenarioPlayer` portals its transport controls so they render at
 * native pixel size at every zoom and stay pinned during camera moves.
 *
 * In video-export mode the component is a transparent passthrough —
 * the Remotion composition owns viewport sizing (and no chrome layer is
 * provided; the export pipeline hides controls anyway).
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
  // Callback-ref state (not a plain ref): the chrome element must flow
  // through context, and a ref mutation would never re-render consumers.
  // Set during commit, so the portal lands before first paint — the bar
  // never flashes at content scale.
  const [chromeTarget, setChromeTarget] = useState<HTMLDivElement | null>(null);

  const innerRef = containerRef ?? internalRef;

  // Layout effect + an immediate synchronous measure: the first paint must
  // already be at the fitted zoom. With observer-only updates the first frame
  // renders at zoom 1, which on canonical widths larger than the container
  // flashes a cropped canvas before the observer fires.
  useLayoutEffect(() => {
    if (isVideoExport) return;
    const outer = outerRef.current;
    if (!outer) return;

    const apply = (width: number) => {
      setZoom(Math.max(Math.min(width / canonicalWidth, 1), minZoom));
    };

    apply(outer.getBoundingClientRect().width);

    const ro = new ResizeObserver((entries) => {
      apply(entries[0]!.contentRect.width);
    });
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

  // Cap the wrapper at the canonical width so the two cannot drift: zoom is
  // capped at 1, so a wider wrapper only adds empty gutters around the
  // canonical-width content. Applied as an inline style (not a class) so it
  // tracks `canonicalWidth` — but only for the default wrapper, so a caller
  // who overrides `wrapperClassName` keeps full control of their own layout.
  const outerStyle: React.CSSProperties | undefined =
    wrapperClassName === DEFAULT_WRAPPER_CLASS ? { maxWidth: canonicalWidth } : undefined;

  return (
    <div ref={outerRef} className={classes} style={outerStyle}>
      <div ref={innerRef} className="relative" style={style}>
        <ViewportChromeProvider value={chromeTarget}>{children}</ViewportChromeProvider>
      </div>
      {/*
       * The chrome layer: a sibling of the zoomed div, so nothing inside it
       * inherits the zoom (or the camera transform, which lives further
       * down). `inset-0` spans the wrapper, whose layout box IS the zoomed
       * content's visual box — chrome positioned `bottom-0` in here sits on
       * the content's visual bottom edge at native pixel size. Rendered
       * after the content so it paints above without z-index games;
       * pointer-events are re-enabled per control (see ViewportChrome.tsx).
       */}
      <div ref={setChromeTarget} className="pointer-events-none absolute inset-0" />
    </div>
  );
}
