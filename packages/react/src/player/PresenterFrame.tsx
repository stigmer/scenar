import type { CSSProperties, RefObject } from "react";
import {
  type PresenterEntry,
  type PresenterWindow,
  presenterOpacityAt,
} from "@scenar/core";
import { useTimeSource } from "../time/TimeSource.js";
import type { PresenterMediaRenderer } from "../video/VideoExportContext.js";

/**
 * The presenter picture-in-picture frame, rendered by ScenarioPlayer
 * while the active step has a presenter clip.
 *
 * Internal to the player (not exported from the package barrel) — the
 * `TitleCardView`/`CaptionOverlay` precedent: the manifest is the API,
 * not the component. Placement is bottom-right inside a maximum box of
 * 24% of the box width at 16:9, deliberately not configurable in v1.
 * The frame's actual shape follows the clip (see {@link frameGeometry}).
 *
 * Styling is fully inline with per-token fallbacks — the TitleCardView
 * pattern — so the frame renders correctly on every surface, including
 * ones that load no stylesheet (the auto-generated Remotion entry).
 * Under `.scenar` the `--scenar-presenter-*` tokens resolve and win.
 *
 * The frame is the single source of visual truth for both outputs;
 * only the media inside its slot differs per time domain:
 *
 * - **Browser** — the player's `usePresenterPlayback` hook drives one
 *   muted `<video>` through `videoRef` and the fade through
 *   `frameRef` (a per-frame style write, like the progress bar).
 * - **Export** — `presenterMedia` (injected through
 *   `VideoExportProvider` by `@scenar/remotion`) renders frame-locked
 *   media, and the fade is computed right here from the frame-driven
 *   time source with the same pure function the browser samples.
 *
 * Like the caption overlay, the frame lives in two coordinate spaces
 * (`sizeVariant`): the viewport's unscaled chrome layer (native CSS
 * pixels, unmoved by camera transforms — a presenter must not zoom
 * with the content) or inline in the export's canonical content box.
 * Width is percentage-based, so both spaces show the same relative
 * size. The chrome variant clears the control bar's band; the export
 * has no control bar.
 *
 * Accessibility: the muted clip is presentational — narration carries
 * the content and captions carry the text channel — so the frame is
 * `aria-hidden`, never focusable, and `pointerEvents: none` (content
 * clicks keep toggling play/pause through it).
 */
/**
 * The frame's maximum box: the `--scenar-presenter-width` token wide
 * at 16:9 — the fixed frame every clip was cover-cropped into before
 * scenar#30 made clip geometry data.
 */
const MAX_BOX_ASPECT = 16 / 9;

const WIDTH_TOKEN = "var(--scenar-presenter-width, 24%)";

/**
 * The frame's shape for one clip: the max box shrunk on one axis so
 * its aspect matches the source exactly — never a crop, never a
 * letterbox (scenar#30: HeyGen clip geometry is avatar-dependent).
 *
 * - 16:9 sources fill the max box, pixel-identical to the pre-#30
 *   frame.
 * - Narrower sources (a near-square studio avatar) keep the max box's
 *   HEIGHT and give up width: `width_token * (9w / 16h)` is exactly
 *   the width whose source-aspect frame is as tall as the 16:9 box,
 *   so a talking head reads the same size on screen and the frame's
 *   vertical intrusion into the content never grows.
 * - Wider sources keep the token width and get shorter (the frame is
 *   bottom-anchored, so it stays settled in the corner).
 *
 * Entries without dimensions (pre-#30 manifests, or a clip the probe
 * could not parse) get the max box itself — the exact legacy style,
 * where `objectFit: cover` on the media still crops as before.
 */
function frameGeometry(entry: PresenterEntry): {
  aspectRatio: string;
  width: string;
} {
  const { width, height } = entry;
  // The manifest is runtime JSON — a system boundary — so malformed
  // dimensions degrade to the legacy frame rather than break layout.
  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return { aspectRatio: "16 / 9", width: WIDTH_TOKEN };
  }
  // Exact integer ratio — no float rounding in the CSS value.
  const aspectRatio = `${width} / ${height}`;
  if (width / height >= MAX_BOX_ASPECT) {
    return { aspectRatio, width: WIDTH_TOKEN };
  }
  return {
    aspectRatio,
    width: `calc(${WIDTH_TOKEN} * ${(9 * width) / (16 * height)})`,
  };
}

interface PresenterFrameProps {
  /** The active step's presenter clip. */
  entry: PresenterEntry;
  /** The clip's timeline window (from `derivePresenterTimeline`). */
  window: PresenterWindow;
  /** Coordinate space — see the component doc. */
  sizeVariant: "chrome" | "canonical";
  /** Browser mode: the element `usePresenterPlayback` drives. */
  videoRef?: RefObject<HTMLVideoElement | null>;
  /** Browser mode: the container whose fade opacity the hook writes. */
  frameRef?: RefObject<HTMLDivElement | null>;
  /** Export mode: the injected frame-locked media renderer. */
  presenterMedia?: PresenterMediaRenderer;
}

export function PresenterFrame({
  entry,
  window: clipWindow,
  sizeVariant,
  videoRef,
  frameRef,
  presenterMedia,
}: PresenterFrameProps) {
  const timeSource = useTimeSource();

  // Export: opacity is a direct function of frame time — Remotion
  // re-renders per frame, so this recomputes deterministically.
  // Browser: start invisible; the playback hook writes the fade.
  const opacity = timeSource
    ? presenterOpacityAt(
        timeSource.currentTimeMs - clipWindow.startMs,
        clipWindow.clipDurationMs,
      )
    : 0;

  const geometry = frameGeometry(entry);

  const frameStyle: CSSProperties = {
    position: "absolute",
    right: "var(--scenar-presenter-margin, 12px)",
    // The chrome variant clears the control bar's band; the export
    // (canonical) has no bar and sits closer to the edge — the caption
    // overlay's margin scale.
    bottom: sizeVariant === "chrome" ? "64px" : "40px",
    // Above the content, below the caption overlay (z-10) and the
    // control bar (z-20) — text channels never hide behind the presenter.
    zIndex: 5,
    width: geometry.width,
    aspectRatio: geometry.aspectRatio,
    borderRadius: "var(--scenar-presenter-radius, 10px)",
    boxShadow:
      "var(--scenar-presenter-shadow, 0 12px 32px -8px rgb(15 23 42 / 0.4), 0 2px 8px -2px rgb(15 23 42 / 0.25))",
    overflow: "hidden",
    pointerEvents: "none",
    opacity,
  };

  // With a dimensioned entry the frame's aspect equals the clip's, so
  // `cover` fits exactly and only absorbs sub-pixel rounding; on the
  // legacy 16:9 fallback it crops, as it always did.
  const mediaStyle: CSSProperties = {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
  };

  return (
    <div
      ref={frameRef}
      aria-hidden
      data-scenar-presenter=""
      style={frameStyle}
    >
      {presenterMedia ? (
        presenterMedia({ src: entry.src, window: clipWindow })
      ) : (
        <video
          ref={videoRef}
          muted
          playsInline
          preload="auto"
          tabIndex={-1}
          style={mediaStyle}
        />
      )}
    </div>
  );
}
