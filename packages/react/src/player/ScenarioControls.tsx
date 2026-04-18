import { type RefObject, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import type { StepTimeline } from "@scenar/core";
import { SpeedMenu } from "./SpeedMenu.js";

interface ScenarioControlsProps {
  visible: boolean;
  playing: boolean;
  muted: boolean;
  playbackRate: number;
  stepIndex: number;
  lastIndex: number;
  stepTimeline: StepTimeline;
  showSpeedControl: boolean;
  hasNarration: boolean;
  progressTrackRef: RefObject<HTMLDivElement | null>;
  playheadRef: RefObject<HTMLDivElement | null>;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onSelectSpeed: (speed: number) => void;
  onSeek: (index: number) => void;
}

/**
 * Video-style transport controls: progress bar, play/pause,
 * mute toggle, and optional speed selector.
 */
export function ScenarioControls({
  visible,
  playing,
  muted,
  playbackRate,
  stepTimeline,
  showSpeedControl,
  hasNarration,
  progressTrackRef,
  playheadRef,
  onTogglePlay,
  onToggleMute,
  onSelectSpeed,
  onSeek,
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
      const clickTimeMs = fraction * stepTimeline.totalDurationMs;
      let target = 0;
      for (let i = stepTimeline.stepStartTimesMs.length - 1; i >= 0; i--) {
        if (clickTimeMs >= (stepTimeline.stepStartTimesMs[i] ?? 0)) {
          target = i;
          break;
        }
      }
      onSeek(target);
    },
    [stepTimeline, onSeek],
  );

  return (
    <motion.div
      className="mt-1 px-1"
      initial={false}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.2 }}
      style={{ pointerEvents: visible ? "auto" : "none" }}
    >
      {/* Progress bar */}
      <div
        className="group relative mb-2 h-1 w-full cursor-pointer rounded-full bg-foreground/15 transition-[height] duration-150 hover:h-1.5"
        onClick={handleProgressClick}
        role="progressbar"
        aria-label="Playback progress"
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          ref={progressTrackRef}
          className="absolute inset-y-0 left-0 rounded-full bg-foreground/60"
        />
        <div
          ref={playheadRef}
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/80 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
        />
        {stepTicks.map((pct, i) => (
          <div
            key={i}
            className="absolute top-0 h-full w-0.5 rounded-full bg-background"
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
          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
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
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
            aria-label={muted ? "Unmute narration" : "Mute narration"}
          >
            {muted ? <VolumeXIcon /> : <VolumeIcon />}
          </button>
        )}

        {showSpeedControl && (
          <SpeedMenu playbackRate={playbackRate} onSelectSpeed={onSelectSpeed} />
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
