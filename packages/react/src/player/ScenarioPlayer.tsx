import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { type NarrationManifest, type ScenarioBundle, type ScenarioStep, computeStepTimeline, deriveStepFromTime } from "@scenar/core";
import { useVideoExport } from "../video/VideoExportContext.js";
import { useViewportChromeTarget } from "../viewport/ViewportChrome.js";
import { useNarrationPlayback } from "../narration/useNarrationPlayback.js";
import * as PlaybackCoordinator from "../playback/PlaybackCoordinator.js";
import { useStepProgression } from "./useStepProgression.js";
import { usePlaybackProgress } from "./usePlaybackProgress.js";
import { PlaybackBurst, ScenarioAudioNotice } from "./PlaybackFeedback.js";
import { ScenarioControls } from "./ScenarioControls.js";
import type { TimeDisplayMode } from "./format-playback-time.js";
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
 * No overlay ever covers the frame — no poster, no pause disc. The
 * YouTube-style control bar (progress bar with chapter markers, time
 * readout, transport with ±10s skips) pins to the content's bottom edge in
 * every state; it is the affordance that says "this plays" at idle, shows
 * the state while paused, and auto-hides after 3 seconds only during
 * playback. Under a `DemoViewport` the bar renders in the viewport's
 * chrome layer (ViewportChrome.tsx) — native pixel size at every zoom,
 * unmoved by camera transforms — and inline everywhere else.
 * Clicking anywhere on the content toggles play/pause with a transient
 * center burst. The player's box is always exactly the content box —
 * overlays never add height — so embeds report one stable size across
 * idle/playing/paused. Only one ScenarioPlayer plays at a time on a page.
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
  // Chrome layer (ViewportChrome.tsx): when a DemoViewport provides an
  // unscaled overlay, the control bar portals there so it renders at native
  // pixel size regardless of viewport zoom and camera transforms. `null`
  // (standalone players, exports, captures) keeps the bar inline.
  const chromeTarget = useViewportChromeTarget();
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
    stepIndex, playbackState, playing, play, pause,
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

      // Seek preserves the play/pause state, so only claim the "single
      // active player" slot when this player actually keeps playing —
      // a paused seek must not pause other players on the page.
      if (playing && coordinatorRef.current) {
        PlaybackCoordinator.notifyPlaying(coordinatorRef.current.id);
      }
    },
    [seekToTime, seekToStep, stepTimeline, lastIndex, playing],
  );

  // Current position for relative seeks, written per frame (and on every
  // paused/idle reposition) by usePlaybackProgress. A ref, not state: the
  // value only matters at the instant a skip button is clicked.
  const currentTimeMsRef = useRef(0);

  // The ±10s transport skips. Each click is one deliberate, absolute seek
  // (clamped by handleSeekToTime), matching every mainstream player — the
  // scrubber's commit-on-release debounce exists for continuous gestures,
  // not discrete clicks.
  const handleSkip = useCallback(
    (deltaMs: number) => {
      handleSeekToTime(currentTimeMsRef.current + deltaMs);
    },
    [handleSeekToTime],
  );

  // Transient center feedback for play/pause toggles. Keyed so rapid
  // clicks restart the animation instead of layering glyphs.
  const [burst, setBurst] = useState<{ kind: "play" | "pause"; key: number } | null>(null);
  const fireBurst = useCallback((kind: "play" | "pause") => {
    setBurst((prev) => ({ kind, key: (prev?.key ?? 0) + 1 }));
  }, []);
  const clearBurst = useCallback(() => setBurst(null), []);

  // Click-anywhere play/pause, including the very first play — there is no
  // poster: nothing ever covers the frame, and the always-present control
  // bar is what marks the content as playable (its play button shows the
  // state, exactly as it does while paused). Starting and resuming go
  // through `handlePlay` so narration starts inside the click gesture (the
  // iOS Safari unlock path); the transient burst confirms every toggle.
  const handleContentClick = useCallback(() => {
    if (playing) {
      fireBurst("pause");
      pause();
    } else {
      fireBurst("play");
      handlePlay();
    }
  }, [playing, pause, handlePlay, fireBurst]);

  // The bar's play/pause button — same semantics as a content click minus
  // the center burst (the button's own icon flip is its feedback). Must go
  // through `handlePlay` too: with no poster, this button can be the first
  // gesture of the session, which is what unlocks narration audio.
  const handleTogglePlayControl = useCallback(() => {
    if (playing) pause();
    else handlePlay();
  }, [playing, pause, handlePlay]);

  // Retry narration inside a fresh gesture after the browser blocked it.
  const handleEnableAudio = useCallback(() => {
    unlock();
  }, [unlock]);

  // Fullscreen: offered only in the packed embed (the iframe already carries
  // `allowfullscreen`), where fullscreening the embed *document* is exactly
  // right — DemoViewport re-fits its zoom to the grown viewport. In-app
  // integrators are not offered a control that would fullscreen their whole
  // page.
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenAvailable =
    embed && typeof document !== "undefined" && document.fullscreenEnabled;

  useEffect(() => {
    if (!fullscreenAvailable) return;
    const onChange = () => setIsFullscreen(document.fullscreenElement != null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [fullscreenAvailable]);

  const handleToggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  // Progress bar refs
  const progressTrackRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);

  // Transport readout (elapsed/total ↔ remaining, toggled by clicking it)
  // and the scrub flag that hands the progress DOM to the drag preview.
  const timeLabelRef = useRef<HTMLSpanElement>(null);
  const scrubbingRef = useRef(false);
  const [timeDisplayMode, setTimeDisplayMode] = useState<TimeDisplayMode>("elapsed");
  const handleToggleTimeDisplay = useCallback(() => {
    setTimeDisplayMode((mode) => (mode === "elapsed" ? "remaining" : "elapsed"));
  }, []);

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
    {
      timeLabelRef,
      timeDisplayMode,
      scrubbingRef,
      currentTimeMsRef,
      // The chrome layer arrives a commit after mount, re-portaling the bar
      // onto fresh DOM nodes; the epoch flip makes the hook rewrite them.
      domEpoch: chromeTarget ? 1 : 0,
    },
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

  // The bar renders in every playback state (auto-hide only applies while
  // playing) — at idle it is the affordance that says "this plays".
  const showControlBar = !hideControls;
  const showAudioNotice = audioBlocked && !isVideoExport && playbackState !== "idle";

  const controlBar = showControlBar && (
    <ScenarioControls
      visible={controlsVisible}
      playing={playing}
      muted={muted}
      playbackRate={playbackRate}
      stepTimeline={stepTimeline}
      showSpeedControl={showSpeedControl}
      hasNarration={!!narrationManifest}
      onToggleFullscreen={fullscreenAvailable ? handleToggleFullscreen : undefined}
      isFullscreen={isFullscreen}
      progressTrackRef={progressTrackRef}
      playheadRef={playheadRef}
      onTogglePlay={handleTogglePlayControl}
      onToggleMute={toggleMute}
      onSelectSpeed={setPlaybackRate}
      onSeekToTime={handleSeekToTime}
      onSkip={handleSkip}
      timeLabelRef={timeLabelRef}
      timeDisplayMode={timeDisplayMode}
      onToggleTimeDisplay={handleToggleTimeDisplay}
      scrubbingRef={scrubbingRef}
    />
  );

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
        style={{ cursor: !isVideoExport ? "pointer" : undefined }}
      >
        {children(steps[stepIndex]!.data, stepIndex)}

        <AnimatePresence>
          {showAudioNotice && <ScenarioAudioNotice onEnableAudio={handleEnableAudio} />}
        </AnimatePresence>

        {burst && !isVideoExport && (
          <PlaybackBurst key={burst.key} kind={burst.kind} onComplete={clearBurst} />
        )}

        {/*
         * Controls overlay the content's bottom edge instead of flowing below
         * it. Invariant: the player's box IS the content box in every playback
         * state — nothing outside it ever appears or disappears — so the embed
         * bridge reports one stable size and host pages never reflow on Play.
         * With a chrome layer the bar portals to the viewport's unscaled
         * overlay (same visual box, native pixel size); portals bubble events
         * through the React tree, so the bar's stopPropagation still shields
         * this div's click-to-toggle, and mousemove on the bar still reaches
         * the container's reveal handler.
         */}
        {chromeTarget ? createPortal(controlBar, chromeTarget) : controlBar}
      </div>

      {narrationManifest && <audio ref={audioRef} preload="none" hidden />}
    </div>
  );
}
