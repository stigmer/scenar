import { type RefObject, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import type { StepTimeline } from "@scenar/core";
import { SpeedMenu } from "./SpeedMenu.js";

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
}

/**
 * Video-style transport controls: progress bar, play/pause,
 * mute toggle, and optional speed selector.
 *
 * Rendered as an overlay pinned to the content's bottom edge (z-20, above the
 * pause overlay's z-10 so transport stays clickable while paused). Keeping the
 * controls *inside* the content box — rather than in flow below it — makes the
 * player's box identical to the content box in every playback state, which is
 * what keeps embed iframes from resizing (and host pages from reflowing) when
 * playback starts.
 *
 * Styling is scrim-relative (white over a bottom gradient), not theme-token
 * based: the controls sit on top of arbitrary tour content, so they follow the
 * video-player convention the poster's pill already uses instead of the
 * light/dark palette of the content behind them.
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
}: ScenarioControlsProps) {
  const stepTicks = useMemo(
    () =>
      stepTimeline.stepStartTimesMs
        .slice(1)
        .map((ms) => (ms / stepTimeline.totalDurationMs) * 100),
    [stepTimeline],
  );

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      onSeekToTime(fraction * stepTimeline.totalDurationMs);
    },
    [stepTimeline, onSeekToTime],
  );

  return (
    <motion.div
      className="absolute inset-x-0 bottom-0 z-20 rounded-b-lg bg-gradient-to-t from-black/60 via-black/25 to-transparent px-3 pb-1.5 pt-8"
      initial={false}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.2 }}
      style={{ pointerEvents: visible ? "auto" : "none" }}
      // The overlay lives inside the content box, whose own click toggles
      // play/pause — a click anywhere on the controls (including the scrim
      // padding between buttons) must not double as a content click.
      onClick={(e) => e.stopPropagation()}
    >
      {/* Progress bar */}
      <div
        className="group relative mb-2 h-1 w-full cursor-pointer rounded-full bg-white/30 transition-[height] duration-150 hover:h-1.5"
        onClick={handleProgressClick}
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
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
        />
        {stepTicks.map((pct, i) => (
          <div
            key={i}
            className="absolute top-0 h-full w-0.5 rounded-full bg-black/50"
            style={{ left: `${pct}%` }}
          />
        ))}
      </div>

      {/* Transport buttons */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePlay();
          }}
          className="flex h-6 w-6 items-center justify-center rounded text-white/75 transition-colors hover:text-white"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>

        {hasNarration && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleMute();
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-white/75 transition-colors hover:text-white"
            aria-label={muted ? "Unmute narration" : "Mute narration"}
          >
            {muted ? <VolumeXIcon /> : <VolumeIcon />}
          </button>
        )}

        {showSpeedControl && (
          <SpeedMenu playbackRate={playbackRate} onSelectSpeed={onSelectSpeed} />
        )}

        {onToggleFullscreen && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFullscreen();
            }}
            className="ml-auto flex h-6 w-6 items-center justify-center rounded text-white/75 transition-colors hover:text-white"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? <MinimizeIcon /> : <MaximizeIcon />}
          </button>
        )}
      </div>
    </motion.div>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

function VolumeXIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

function MaximizeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function MinimizeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 3v3a2 2 0 0 1-2 2H3" />
      <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
      <path d="M3 16h3a2 2 0 0 1 2 2v3" />
      <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
    </svg>
  );
}
