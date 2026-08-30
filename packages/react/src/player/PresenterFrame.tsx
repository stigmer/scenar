import type { RefObject } from "react";
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
 * not the component. Placement is bottom-right at 24% of the box
 * width (16:9), deliberately not configurable in v1.
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
 * `aria-hidden`, never focusable, and `pointer-events-none` (content
 * clicks keep toggling play/pause through it).
 */
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

  return (
    <div
      ref={frameRef}
      aria-hidden
      data-scenar-presenter=""
      // z-[5]: above the content, below the caption overlay (z-10) and
      // the control bar (z-20) — text channels never hide behind the
      // presenter.
      className={`pointer-events-none absolute z-[5] overflow-hidden ${
        sizeVariant === "chrome" ? "bottom-16" : "bottom-10"
      }`}
      style={{
        right: "var(--scenar-presenter-margin)",
        width: "var(--scenar-presenter-width)",
        aspectRatio: "16 / 9",
        borderRadius: "var(--scenar-presenter-radius)",
        boxShadow: "var(--scenar-presenter-shadow)",
        opacity,
      }}
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
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}
