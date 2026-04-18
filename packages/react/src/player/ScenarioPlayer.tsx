import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { type NarrationManifest, type ScenarioStep, computeStepTimeline } from "@scenar/core";
import { useVideoExport } from "../video/VideoExportContext.js";
import { useNarrationPlayback } from "../narration/useNarrationPlayback.js";
import * as PlaybackCoordinator from "../playback/PlaybackCoordinator.js";
import { useStepProgression } from "./useStepProgression.js";
import { usePlaybackProgress } from "./usePlaybackProgress.js";
import { ScenarioPoster } from "./ScenarioPoster.js";
import { ScenarioControls } from "./ScenarioControls.js";

/** Delay before auto-hiding the control bar during playback. */
const CONTROLS_HIDE_DELAY_MS = 3_000;

interface ScenarioPlayerProps<T> {
  /** Ordered steps in the playback timeline. */
  steps: ScenarioStep<T>[];
  /** Render function — receives current step data and step index. */
  children: (data: T, stepIndex: number) => ReactNode;
  /** Additional CSS class names for the outer container. */
  className?: string;
  /** Fires when the active step changes (after the step is rendered). */
  onStepChange?: (data: T, index: number) => void;
  /** Audio manifest produced by the narration build script. */
  narrationManifest?: NarrationManifest;
  /** Show a speed selector in the control bar. Defaults to true. */
  showSpeedControl?: boolean;
}

/**
 * Video-style playback engine for timed scenario animations.
 *
 * Renders a poster overlay with a centered play button on initial load.
 * The user clicks to start playback. When playing, a YouTube-style
 * progress bar with chapter markers and transport controls auto-hides
 * after 3 seconds. Only one ScenarioPlayer plays at a time on a page.
 *
 * Renders content via a children render prop — the engine knows nothing
 * about what is being displayed. Respects `prefers-reduced-motion`.
 */
export function ScenarioPlayer<T>({
  steps,
  children,
  className,
  onStepChange,
  narrationManifest,
  showSpeedControl = true,
}: ScenarioPlayerProps<T>) {
  const prefersReducedMotion = useReducedMotion();
  const { isVideoExport, hideControls, initialMuted: videoExportMuted } = useVideoExport();
  const lastIndex = steps.length - 1;
  const containerRef = useRef<HTMLDivElement>(null);

  const [playbackRate, setPlaybackRate] = useState(() => {
    if (typeof window === "undefined") return 1;
    const param = new URLSearchParams(window.location.search).get("__test_speed");
    const parsed = param ? Number(param) : NaN;
    return parsed > 0 && parsed <= 16 ? parsed : 1;
  });

  const effectiveInitialMuted = isVideoExport ? videoExportMuted : false;
  const [progressionMuted, setProgressionMuted] = useState(effectiveInitialMuted);

  const progression = useStepProgression({
    steps,
    narrationManifest,
    muted: progressionMuted,
    playbackRate,
    isVideoExport,
    prefersReducedMotion,
    onClipEnded: () => {},
  });

  const { stepIndex, playbackState, playing, play, pause, togglePlay, goTo, handleClipEnded } = progression;

  // Coordinator: single-active-player
  const coordinatorRef = useRef<{ id: string; unregister: () => void } | null>(null);

  useEffect(() => {
    if (isVideoExport) return;
    coordinatorRef.current = PlaybackCoordinator.register(() => {
      pause();
    });
    return () => coordinatorRef.current?.unregister();
  }, [isVideoExport, pause]);

  // Viewport auto-pause
  useEffect(() => {
    const el = containerRef.current;
    if (!el || isVideoExport) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting && playing) pause();
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isVideoExport, playing, pause]);

  const { muted, toggleMute, audioRef } = useNarrationPlayback({
    manifest: narrationManifest,
    stepIndex,
    playing,
    initialMuted: effectiveInitialMuted,
    playbackRate,
    onClipEnded: handleClipEnded,
  });

  // Keep progression's muted state in sync with narration so step
  // timers respect narration duration when audio is unmuted.
  useEffect(() => {
    setProgressionMuted(muted);
  }, [muted]);

  const stepTimeline = useMemo(
    () => computeStepTimeline(steps, muted ? null : narrationManifest),
    [steps, muted, narrationManifest],
  );

  // Step change callback
  useEffect(() => {
    onStepChange?.(steps[stepIndex]!.data, stepIndex);
  }, [stepIndex, steps, onStepChange]);

  // Controls auto-hide
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_DELAY_MS);
  }, []);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (playbackState === "playing") scheduleHide();
  }, [playbackState, scheduleHide]);

  useEffect(() => {
    if (playbackState !== "playing") {
      setControlsVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    } else {
      scheduleHide();
    }
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [playbackState, scheduleHide]);

  const handlePlay = useCallback(() => {
    play();
    if (coordinatorRef.current) {
      PlaybackCoordinator.notifyPlaying(coordinatorRef.current.id);
    }
  }, [play]);

  const handleContentClick = useCallback(() => {
    if (playbackState === "idle") return;
    togglePlay();
  }, [playbackState, togglePlay]);

  // Progress bar refs
  const progressTrackRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);

  usePlaybackProgress(
    playing,
    playbackState,
    stepIndex,
    lastIndex,
    playbackRate,
    stepTimeline,
    progressTrackRef,
    playheadRef,
  );

  const caption = steps[stepIndex]!.caption;
  const showPoster = playbackState === "idle" && !isVideoExport && !prefersReducedMotion;
  const showControlBar = playbackState !== "idle" && !hideControls;

  return (
    <div
      ref={containerRef}
      className={className}
      data-demo-step={stepIndex}
      data-demo-state={playbackState}
      data-demo-total-steps={steps.length}
      onMouseMove={showControlBar ? revealControls : undefined}
    >
      <div
        className="relative"
        onClick={handleContentClick}
        style={{ cursor: playbackState !== "idle" ? "pointer" : undefined }}
      >
        {children(steps[stepIndex]!.data, stepIndex)}

        <AnimatePresence>
          {showPoster && <ScenarioPoster onPlay={handlePlay} />}
        </AnimatePresence>
      </div>

      {narrationManifest && <audio ref={audioRef} preload="none" hidden />}

      <div className="mt-2 flex h-6 items-center justify-center">
        <AnimatePresence mode="wait">
          {caption && (
            <motion.p
              key={caption}
              className="text-sm font-medium text-foreground/70"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              {caption}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {showControlBar && (
        <ScenarioControls
          visible={controlsVisible}
          playing={playing}
          muted={muted}
          playbackRate={playbackRate}
          stepIndex={stepIndex}
          lastIndex={lastIndex}
          stepTimeline={stepTimeline}
          showSpeedControl={showSpeedControl}
          hasNarration={!!narrationManifest}
          progressTrackRef={progressTrackRef}
          playheadRef={playheadRef}
          onTogglePlay={togglePlay}
          onToggleMute={toggleMute}
          onSelectSpeed={setPlaybackRate}
          onSeek={goTo}
        />
      )}
    </div>
  );
}
