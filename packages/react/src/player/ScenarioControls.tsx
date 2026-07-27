import { type RefObject, useCallback, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { StepTimeline } from "@scenar/core";
import { SpeedMenu } from "./SpeedMenu.js";
import { formatTimeLabel, type TimeDisplayMode } from "./format-playback-time.js";

interface ScenarioControlsProps {
  visible: boolean;
  playing: boolean;
  muted: boolean;
  playbackRate: number;
  stepTimeline: StepTimeline;
  showSpeedControl: boolean;
  hasNarration: boolean;
  /** Render the fullscreen toggle. Undefined hides the control entirely. */
  onToggleFullscreen?: () => void;
  /** Whether the page is currently fullscreen (drives the toggle icon). */
  isFullscreen?: boolean;
  progressTrackRef: RefObject<HTMLDivElement | null>;
  playheadRef: RefObject<HTMLDivElement | null>;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onSelectSpeed: (speed: number) => void;
  onSeekToTime: (timeMs: number) => void;
  /**
   * Element for the transport readout, written by `usePlaybackProgress`
   * via `textContent` (and by the drag preview during a scrub). Rendered
   * childless so React never reconciles over the manual writes. The readout
   * is omitted entirely when this ref is not provided.
   */
  timeLabelRef?: RefObject<HTMLSpanElement | null>;
  /** Which quantity the readout shows. Defaults to `"elapsed"`. */
  timeDisplayMode?: TimeDisplayMode;
  /** Fired when the viewer clicks the readout (elapsed ↔ remaining). */
  onToggleTimeDisplay?: () => void;
  /**
   * Set true for the duration of a scrub gesture so `usePlaybackProgress`
   * yields the progress DOM to the drag preview. Optional: without it the
   * bar still seeks correctly, the preview just competes with the RAF loop.
   */
  scrubbingRef?: RefObject<boolean>;
}

/**
 * Video-style transport controls: progress bar (click or drag to seek),
 * play/pause, volume (disabled when the tour has no narration), time
 * readout, and optional speed selector and fullscreen toggle — laid out
 * YouTube-style (transport + readout on the left, settings on the right).
 *
 * Rendered as an overlay pinned to the content's bottom edge (z-20, above
 * every content overlay so transport stays clickable while paused). Keeping
 * the controls *inside* the content box — rather than in flow below it —
 * makes the player's box identical to the content box in every playback
 * state, which is what keeps embed iframes from resizing (and host pages
 * from reflowing) when playback starts.
 *
 * Styling is scrim-relative (white over a bottom gradient), not theme-token
 * based: the controls sit on top of arbitrary tour content, so they follow the
 * video-player convention the poster's pill already uses instead of the
 * light/dark palette of the content behind them.
 *
 * Seeking commits once on pointer-up, not per pointer-move: every seek
 * restarts the narration clip at the target offset, so live-seeking during a
 * drag would thrash audio. During the drag the bar and readout preview the
 * target position (this component writes the same DOM refs the RAF loop
 * owns, which stands down via `scrubbingRef`).
 */
export function ScenarioControls({
  visible,
  playing,
  muted,
  playbackRate,
  stepTimeline,
  showSpeedControl,
  hasNarration,
  onToggleFullscreen,
  isFullscreen = false,
  progressTrackRef,
  playheadRef,
  onTogglePlay,
  onToggleMute,
  onSelectSpeed,
  onSeekToTime,
  timeLabelRef,
  timeDisplayMode = "elapsed",
  onToggleTimeDisplay,
  scrubbingRef,
}: ScenarioControlsProps) {
  const stepTicks = useMemo(
    () =>
      stepTimeline.stepStartTimesMs
        .slice(1)
        .map((ms) => (ms / stepTimeline.totalDurationMs) * 100),
    [stepTimeline],
  );

  // Scrub gesture state. `scrubbing` (state) drives the enlarged-bar visuals;
  // the fraction lives in a ref because pointer-moves must not re-render.
  const [scrubbing, setScrubbing] = useState(false);
  const scrubFractionRef = useRef(0);

  const previewScrub = useCallback(
    (fraction: number) => {
      scrubFractionRef.current = fraction;
      const pct = `${fraction * 100}%`;
      if (progressTrackRef.current) progressTrackRef.current.style.width = pct;
      if (playheadRef.current) playheadRef.current.style.left = pct;
      if (timeLabelRef?.current) {
        timeLabelRef.current.textContent = formatTimeLabel(
          fraction * stepTimeline.totalDurationMs,
          stepTimeline.totalDurationMs,
          timeDisplayMode,
        );
      }
    },
    [progressTrackRef, playheadRef, timeLabelRef, stepTimeline, timeDisplayMode],
  );

  const fractionFromPointer = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      if (scrubbingRef) scrubbingRef.current = true;
      setScrubbing(true);
      previewScrub(fractionFromPointer(e));
    },
    [scrubbingRef, previewScrub, fractionFromPointer],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      previewScrub(fractionFromPointer(e));
    },
    [previewScrub, fractionFromPointer],
  );

  // Shared by pointer-up and pointer-cancel: a cancelled gesture (e.g. a
  // touch stolen by scrolling) commits the last previewed position rather
  // than leaving the bar showing a position playback is not at.
  const handlePointerEnd = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      e.currentTarget.releasePointerCapture(e.pointerId);
      previewScrub(fractionFromPointer(e));
      if (scrubbingRef) scrubbingRef.current = false;
      setScrubbing(false);
      onSeekToTime(scrubFractionRef.current * stepTimeline.totalDurationMs);
    },
    [previewScrub, fractionFromPointer, scrubbingRef, onSeekToTime, stepTimeline],
  );

  return (
    <motion.div
      className="absolute inset-x-0 bottom-0 z-20 rounded-b-lg bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 pb-2 pt-10"
      initial={false}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.2 }}
      style={{ pointerEvents: visible ? "auto" : "none" }}
      // The overlay lives inside the content box, whose own click toggles
      // play/pause — a click anywhere on the controls (including the scrim
      // padding between buttons) must not double as a content click.
      onClick={(e) => e.stopPropagation()}
    >
      {/* Progress bar — click or drag to seek; commits on release. */}
      <div
        className={`group relative mb-2 w-full cursor-pointer rounded-full bg-white/30 transition-[height] duration-150 ${
          scrubbing ? "h-2" : "h-[5px] hover:h-2"
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        role="progressbar"
        aria-label="Playback progress"
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          ref={progressTrackRef}
          className="absolute inset-y-0 left-0 rounded-full bg-white/80"
        />
        <div
          ref={playheadRef}
          className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-sm transition-opacity ${
            scrubbing ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        />
        {stepTicks.map((pct, i) => (
          <div
            key={i}
            className="absolute top-0 h-full w-0.5 rounded-full bg-black/50"
            style={{ left: `${pct}%` }}
          />
        ))}
      </div>

      {/* Transport buttons: play/mute/time on the left, settings on the right. */}
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePlay();
          }}
          className="flex h-9 w-9 items-center justify-center rounded text-white/90 transition-colors hover:text-white"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>

        {/*
         * The volume control is always present so the bar reads the same on
         * every tour (Jakob's Law — YouTube never hides it). Without
         * narration there is nothing to mute, so it renders disabled with
         * the muted glyph rather than disappearing.
         */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasNarration) onToggleMute();
          }}
          disabled={!hasNarration}
          className={`flex h-9 w-9 items-center justify-center rounded transition-colors ${
            hasNarration ? "text-white/90 hover:text-white" : "text-white/40"
          }`}
          aria-label={
            hasNarration
              ? muted
                ? "Unmute narration"
                : "Mute narration"
              : "No narration audio"
          }
        >
          {!hasNarration || muted ? <VolumeXIcon /> : <VolumeIcon />}
        </button>

        {timeLabelRef && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleTimeDisplay?.();
            }}
            className="rounded px-1 text-xs font-medium tabular-nums text-white/90 transition-colors hover:text-white"
            aria-label={
              timeDisplayMode === "elapsed" ? "Show remaining time" : "Show elapsed time"
            }
          >
            {/* Childless span: usePlaybackProgress owns its textContent. */}
            <span ref={timeLabelRef} />
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {showSpeedControl && (
            <SpeedMenu playbackRate={playbackRate} onSelectSpeed={onSelectSpeed} />
          )}

          {onToggleFullscreen && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFullscreen();
              }}
              className="flex h-9 w-9 items-center justify-center rounded text-white/90 transition-colors hover:text-white"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? <MinimizeIcon /> : <MaximizeIcon />}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

function VolumeXIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

function MaximizeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function MinimizeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 3v3a2 2 0 0 1-2 2H3" />
      <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
      <path d="M3 16h3a2 2 0 0 1 2 2v3" />
      <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
    </svg>
  );
}
