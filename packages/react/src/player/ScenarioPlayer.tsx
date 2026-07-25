import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { type NarrationManifest, type ScenarioBundle, type ScenarioStep, computeStepTimeline, deriveStepFromTime } from "@scenar/core";
import { useVideoExport } from "../video/VideoExportContext.js";
import { useNarrationPlayback } from "../narration/useNarrationPlayback.js";
import * as PlaybackCoordinator from "../playback/PlaybackCoordinator.js";
import { useStepProgression } from "./useStepProgression.js";
import { usePlaybackProgress } from "./usePlaybackProgress.js";
import { ScenarioAudioNotice, ScenarioPauseOverlay, ScenarioPoster } from "./ScenarioPoster.js";
import { ScenarioControls } from "./ScenarioControls.js";
import { useScenarEmbedBridge } from "../embed/useScenarEmbedBridge.js";

/** Delay before auto-hiding the control bar during playback. */
const CONTROLS_HIDE_DELAY_MS = 3_000;

interface ScenarioPlayerProps<T> {
  /**
   * Self-contained scenario bundle (steps + narration manifest).
   * When provided, `steps` and `narrationManifest` are extracted from the
   * bundle.  Individual `steps` / `narrationManifest` props take precedence
   * when both are specified.
   */
  bundle?: ScenarioBundle<T>;
  /** Ordered steps in the playback timeline. */
  steps?: ScenarioStep<T>[];
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
  /**
   * Enable the cross-origin embed bridge (postMessage events + host commands +
   * resize reporting). Intended for the packed iframe embed; leave `false` for
   * normal in-app embedding so the host never receives unexpected messages. The
   * bridge stays inert unless the player is also running inside a frame.
   */
  embed?: boolean;
}

/**
 * Video-style playback engine for timed scenario animations.
 *
 * Renders a poster overlay with a centered play button on initial load.
 * The user clicks to start playback. When playing, a YouTube-style
 * progress bar with chapter markers and transport controls overlays the
 * content's bottom edge and auto-hides after 3 seconds. The player's box
 * is always exactly the content box — overlays never add height — so
 * embeds report one stable size across idle/playing/paused. Only one
 * ScenarioPlayer plays at a time on a page.
 *
 * Renders content via a children render prop — the engine knows nothing
 * about what is being displayed. Respects `prefers-reduced-motion`.
 */
export function ScenarioPlayer<T>({
  bundle,
  steps: stepsProp,
  children,
  className,
  onStepChange,
  narrationManifest: manifestProp,
  showSpeedControl = true,
  embed = false,
}: ScenarioPlayerProps<T>) {
  const steps = stepsProp ?? bundle?.steps;
  const narrationManifest = manifestProp ?? bundle?.narrationManifest;

  if (!steps || steps.length === 0) {
    throw new Error(
      "ScenarioPlayer requires steps. Provide a `bundle` or `steps` prop.",
    );
  }

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

  const {
    stepIndex, playbackState, playing, play, pause, togglePlay,
    seekToTime, seekOffsetRef, seekGeneration, handleClipEnded,
  } = progression;

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

  const {
    muted, toggleMute, audioRef, seekToStep, audioBlocked, unlock, setVolume, prefetch,
  } = useNarrationPlayback({
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
    // Start narration synchronously in the click's call stack — this is what
    // unlocks audio on iOS Safari. `play()` then flips playback state and the
    // narration effects take over.
    unlock();
    play();
    if (coordinatorRef.current) {
      PlaybackCoordinator.notifyPlaying(coordinatorRef.current.id);
    }
  }, [play, unlock]);

  const handleSeekToTime = useCallback(
    (timeMs: number) => {
      const clamped = Math.max(0, Math.min(timeMs, stepTimeline.totalDurationMs));
      const targetIndex = deriveStepFromTime(clamped, stepTimeline.stepStartTimesMs, lastIndex);
      const stepStart = stepTimeline.stepStartTimesMs[targetIndex] ?? 0;
      seekToStep(targetIndex, Math.max(0, clamped - stepStart));
      seekToTime(clamped, stepTimeline);

      if (coordinatorRef.current) {
        PlaybackCoordinator.notifyPlaying(coordinatorRef.current.id);
      }
    },
    [seekToTime, seekToStep, stepTimeline, lastIndex],
  );

  const handleContentClick = useCallback(() => {
    if (playbackState === "idle") return;
    togglePlay();
  }, [playbackState, togglePlay]);

  // Retry narration inside a fresh gesture after the browser blocked it.
  const handleEnableAudio = useCallback(() => {
    unlock();
  }, [unlock]);

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
    seekOffsetRef,
    seekGeneration,
  );

  // Cross-origin embed bridge: inert unless `embed` is set and we are framed.
  useScenarEmbedBridge({
    enabled: embed,
    containerRef,
    playbackState,
    stepIndex,
    totalSteps: steps.length,
    stepTimeline,
    hasNarration: !!narrationManifest,
    audioBlocked,
    controls: {
      play: handlePlay,
      pause,
      seekToTime: handleSeekToTime,
      setMuted: (next: boolean) => {
        if (muted !== next) toggleMute();
      },
      setVolume,
      prefetch,
    },
  });

  const showPoster = playbackState === "idle" && !isVideoExport && !prefersReducedMotion;
  const showPauseOverlay = playbackState === "paused" && !isVideoExport;
  const showControlBar = playbackState !== "idle" && !hideControls;
  const showAudioNotice = audioBlocked && !isVideoExport && playbackState !== "idle";

  return (
    <div
      ref={containerRef}
      className={className}
      data-demo-step={stepIndex}
      data-demo-state={playbackState}
      data-demo-total-steps={steps.length}
      data-demo-audio-blocked={audioBlocked ? "" : undefined}
      onMouseMove={showControlBar ? revealControls : undefined}
    >
      <div
        className="relative"
        onClick={handleContentClick}
        style={{ cursor: playbackState !== "idle" ? "pointer" : undefined }}
      >
        {children(steps[stepIndex]!.data, stepIndex)}

        <AnimatePresence>
          {showPoster && (
            <ScenarioPoster onPlay={handlePlay} hasNarration={!!narrationManifest} />
          )}
          {showPauseOverlay && <ScenarioPauseOverlay onResume={handlePlay} />}
          {showAudioNotice && <ScenarioAudioNotice onEnableAudio={handleEnableAudio} />}
        </AnimatePresence>

        {/*
         * Controls overlay the content's bottom edge instead of flowing below
         * it. Invariant: the player's box IS the content box in every playback
         * state — nothing outside it ever appears or disappears — so the embed
         * bridge reports one stable size and host pages never reflow on Play.
         */}
        {showControlBar && (
          <ScenarioControls
            visible={controlsVisible}
            playing={playing}
            muted={muted}
            playbackRate={playbackRate}
            stepTimeline={stepTimeline}
            showSpeedControl={showSpeedControl}
            hasNarration={!!narrationManifest}
            progressTrackRef={progressTrackRef}
            playheadRef={playheadRef}
            onTogglePlay={togglePlay}
            onToggleMute={toggleMute}
            onSelectSpeed={setPlaybackRate}
            onSeekToTime={handleSeekToTime}
          />
        )}
      </div>

      {narrationManifest && <audio ref={audioRef} preload="none" hidden />}
    </div>
  );
}
