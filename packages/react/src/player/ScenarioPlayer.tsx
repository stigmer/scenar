import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { type NarrationManifest, type PresenterManifest, type ScenarEmbedViewport, type ScenarioBundle, type ScenarioStep, type Soundtrack, type StepCard, computeStepTimeline, derivePresenterTimeline, deriveStepFromTime } from "@scenar/core";
import { useVideoExport } from "../video/VideoExportContext.js";
import { useViewportChromeTarget, useViewportHostScaleSetter } from "../viewport/ViewportChrome.js";
import { useNarrationPlayback } from "../narration/useNarrationPlayback.js";
import { usePresenterPlayback } from "../presenter/usePresenterPlayback.js";
import { useSoundtrackPlayback, type SoundtrackSources } from "../soundtrack/useSoundtrackPlayback.js";
import * as PlaybackCoordinator from "../playback/PlaybackCoordinator.js";
import { useStepProgression } from "./useStepProgression.js";
import { usePlaybackProgress } from "./usePlaybackProgress.js";
import { PlaybackBurst, ScenarioAudioNotice } from "./PlaybackFeedback.js";
import { CaptionOverlay } from "./CaptionOverlay.js";
import { PresenterFrame } from "./PresenterFrame.js";
import { TitleCardView } from "./TitleCardView.js";
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
  /**
   * Fires when the active step changes to an AUTHORED step (after the
   * step is rendered). Synthesized card steps are excluded — their
   * `data` is an engine placeholder, not the integrator's `T` — and
   * announce themselves through {@link onCardStepChange} instead.
   */
  onStepChange?: (data: T, index: number) => void;
  /**
   * Fires when the active step changes to a synthesized card step
   * (`ScenarioStep.card`) — the card-step sibling of {@link onStepChange},
   * delivering the card and the step index with honest types.
   *
   * Hosts that wire the interaction system themselves (the packed embed
   * entry, `useStepInteractions` integrators) must track the index from
   * BOTH callbacks so card-step interactions — the outro's cursor-clear
   * and viewport-reset housekeeping — reach their scheduler.
   */
  onCardStepChange?: (card: StepCard, index: number) => void;
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
  /**
   * The canonical viewport the surrounding bundle was packed at, forwarded to
   * the host on the bridge's `ready` event so it can adopt iframe-as-screen
   * scaling. Only meaningful with `embed`; the packed entry supplies it from
   * the same numbers it passes to `DemoViewport`.
   */
  embedViewport?: ScenarEmbedViewport;
  /**
   * Enable step captions: each step's `narration` text renders as a
   * subtitle-style overlay, initially visible, with a CC toggle in the
   * control bar so the viewer can hide them. A presentation preference,
   * not part of the scenario definition — the same scenario plays with or
   * without captions. Defaults to false; without it the player renders no
   * caption DOM and no CC control, exactly as before the feature existed.
   */
  captions?: boolean;
  /**
   * The scenario's soundtrack (background music with narration ducking,
   * interaction sound effects). When provided, takes precedence over
   * `bundle.soundtrack`. Part of the scenario definition — authored in
   * the spec, played in both the embed and the exported video. Absent
   * means silent apart from narration, exactly as before the feature.
   */
  soundtrack?: Soundtrack;
  /**
   * Resolved asset URL overrides for soundtrack playback (music file,
   * SFX set). Most integrators never set this — see `SoundtrackSources`
   * for the defaults. The packed embed passes bundle-relative URLs.
   */
  soundtrackSources?: SoundtrackSources;
  /**
   * Presenter clip manifest produced by `scenar presenter` (fetched
   * with `usePresenterManifest` for direct embeds). When provided,
   * takes precedence over `bundle.presenterManifest`. Steps with a
   * clip show it picture-in-picture, muted — narration remains the
   * single audio source. Absent means no presenter: zero presenter
   * DOM and zero fetched bytes, exactly as before the feature.
   */
  presenterManifest?: PresenterManifest;
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
  onCardStepChange,
  narrationManifest: manifestProp,
  showSpeedControl = true,
  embed = false,
  embedViewport,
  captions = false,
  soundtrack: soundtrackProp,
  soundtrackSources,
  presenterManifest: presenterManifestProp,
}: ScenarioPlayerProps<T>) {
  const steps = stepsProp ?? bundle?.steps;
  const narrationManifest = manifestProp ?? bundle?.narrationManifest;
  const soundtrack = soundtrackProp ?? bundle?.soundtrack;
  const presenterManifest = presenterManifestProp ?? bundle?.presenterManifest;

  if (!steps || steps.length === 0) {
    throw new Error(
      "ScenarioPlayer requires steps. Provide a `bundle` or `steps` prop.",
    );
  }

  const prefersReducedMotion = useReducedMotion();
  const { isVideoExport, hideControls, initialMuted: videoExportMuted, presenterMedia } = useVideoExport();
  // Chrome layer (ViewportChrome.tsx): when a DemoViewport provides an
  // unscaled overlay, the control bar portals there so it renders at native
  // pixel size regardless of viewport zoom and camera transforms. `null`
  // (standalone players, exports, captures) keeps the bar inline.
  const chromeTarget = useViewportChromeTarget();
  // Host-scale reverse channel (ViewportChrome.tsx): the bridge receives the
  // iframe-as-screen scale factor from the host and hands it up to the
  // DemoViewport, whose chrome overlay counter-zooms. `null` when no
  // viewport provides an overlay — nothing to counter-scale.
  const setViewportHostScale = useViewportHostScaleSetter();
  const lastIndex = steps.length - 1;
  const containerRef = useRef<HTMLDivElement>(null);

  // Current position for relative seeks and soundtrack sync, written per
  // frame (and on every paused/idle reposition) by usePlaybackProgress.
  // A ref, not state: readers only need the instantaneous value (a skip
  // click, a gain-automation frame), never a re-render.
  const currentTimeMsRef = useRef(0);

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
    presenterManifest,
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

  // Soundtrack (music + SFX) shares narration's mute switch and unlock
  // gesture; inert during video export (the Remotion composition places
  // all export audio itself).
  const soundtrackAudio = useSoundtrackPlayback({
    soundtrack,
    steps,
    narrationManifest,
    stepIndex,
    playing,
    muted,
    playbackRate,
    isVideoExport,
    currentTimeMsRef,
    sources: soundtrackSources,
  });
  const hasAudibleSoundtrack =
    !isVideoExport && !!soundtrack && (!!soundtrack.musicSrc || soundtrack.sfx === true);

  // While muted, presenter clip durations stand in for narration's in
  // the timeline (they are equal by construction — the clip is derived
  // from the narration audio), so the progress bar, scrubbing, the
  // embed bridge, and the muted step scheduler all read one clock and
  // muted timing converges on the export timeline for presenter steps.
  const stepTimeline = useMemo(
    () => computeStepTimeline(steps, muted ? (presenterManifest ?? null) : narrationManifest),
    [steps, muted, narrationManifest, presenterManifest],
  );

  const presenterWindows = useMemo(
    () => derivePresenterTimeline(presenterManifest, stepTimeline),
    [presenterManifest, stepTimeline],
  );

  // The presenter is pure motion with no text channel of its own, so a
  // reduced-motion viewer gets no presenter at all (the player already
  // jumps to the last step for them).
  const presenterEnabled = !!presenterManifest && !prefersReducedMotion;

  const presenter = usePresenterPlayback({
    manifest: presenterManifest,
    stepIndex,
    playing,
    idle: playbackState === "idle",
    muted,
    playbackRate,
    audioRef,
    currentTimeMsRef,
    stepTimeline,
    enabled: presenterEnabled && !isVideoExport,
  });

  // Step change callbacks. Card steps announce through their own
  // callback: their `data` is an engine placeholder, and fabricating a
  // `T` for onStepChange would violate the integrator's type parameter
  // (see ScenarioStep.card).
  useEffect(() => {
    const step = steps[stepIndex]!;
    if (step.card) onCardStepChange?.(step.card, stepIndex);
    else onStepChange?.(step.data, stepIndex);
  }, [stepIndex, steps, onStepChange, onCardStepChange]);

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
    // Start narration and soundtrack synchronously in the click's call
    // stack — this is what unlocks audio on iOS Safari. `play()` then
    // flips playback state and the audio effects take over.
    unlock();
    soundtrackAudio.unlock();
    play();
    if (coordinatorRef.current) {
      PlaybackCoordinator.notifyPlaying(coordinatorRef.current.id);
    }
  }, [play, unlock, soundtrackAudio]);

  const handleSeekToTime = useCallback(
    (timeMs: number) => {
      const clamped = Math.max(0, Math.min(timeMs, stepTimeline.totalDurationMs));
      const targetIndex = deriveStepFromTime(clamped, stepTimeline.stepStartTimesMs, lastIndex);
      const stepStart = stepTimeline.stepStartTimesMs[targetIndex] ?? 0;
      seekToStep(targetIndex, Math.max(0, clamped - stepStart));
      presenter.seekToStep(targetIndex, Math.max(0, clamped - stepStart));
      seekToTime(clamped, stepTimeline);
      soundtrackAudio.seekTo(clamped);

      // Seek preserves the play/pause state, so only claim the "single
      // active player" slot when this player actually keeps playing —
      // a paused seek must not pause other players on the page.
      if (playing && coordinatorRef.current) {
        PlaybackCoordinator.notifyPlaying(coordinatorRef.current.id);
      }
    },
    [seekToTime, seekToStep, presenter.seekToStep, stepTimeline, lastIndex, playing, soundtrackAudio],
  );

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

  // Captions: the `captions` prop makes them *available* (and initially
  // visible); this state is the viewer's CC toggle thereafter. Kept
  // regardless of the prop so hook order is stable; without the prop no
  // caption DOM or CC control ever renders.
  const [captionsVisible, setCaptionsVisible] = useState(captions);
  const handleToggleCaptions = useCallback(() => {
    setCaptionsVisible((visible) => !visible);
  }, []);

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
    viewport: embedViewport,
    controls: {
      play: handlePlay,
      pause,
      seekToTime: handleSeekToTime,
      setMuted: (next: boolean) => {
        if (muted !== next) toggleMute();
      },
      setVolume,
      setHostScale: setViewportHostScale ?? undefined,
      prefetch,
    },
  });

  // The bar renders in every playback state (auto-hide only applies while
  // playing) — at idle it is the affordance that says "this plays".
  const showControlBar = !hideControls;
  const showAudioNotice = audioBlocked && !isVideoExport && playbackState !== "idle";

  // The active step's caption. Empty/absent narration renders nothing —
  // steps without a script simply play uncaptioned.
  const captionText = captions && captionsVisible ? steps[stepIndex]!.narration : undefined;

  // The presenter frame mounts only while the active step has a clip
  // (steps without one render zero presenter DOM). Its media slot is
  // per time domain: the injected frame-locked renderer in export, the
  // hook-driven muted <video> in the browser.
  const activePresenterEntry = presenterEnabled
    ? (presenterManifest!.steps[stepIndex] ?? null)
    : null;
  const activePresenterWindow = activePresenterEntry
    ? presenterWindows.find((w) => w.stepIndex === stepIndex)
    : undefined;

  const presenterFrame = activePresenterEntry && activePresenterWindow && (
    <PresenterFrame
      entry={activePresenterEntry}
      window={activePresenterWindow}
      // Export renders inline in the canonical content box; every other
      // surface renders in native CSS pixels (the caption convention).
      sizeVariant={isVideoExport ? "canonical" : "chrome"}
      videoRef={presenter.videoRef}
      frameRef={presenter.frameRef}
      presenterMedia={isVideoExport ? presenterMedia : undefined}
    />
  );

  const captionOverlay = !!captionText && (
    <CaptionOverlay
      text={captionText}
      // Export renders inline in the canonical content box (no chrome
      // layer), so the caption uses canonical-pixel subtitle sizing; every
      // other surface renders at native CSS pixels.
      sizeVariant={isVideoExport ? "canonical" : "chrome"}
      controlBarVisible={showControlBar && controlsVisible}
    />
  );

  const controlBar = showControlBar && (
    <ScenarioControls
      visible={controlsVisible}
      playing={playing}
      muted={muted}
      playbackRate={playbackRate}
      stepTimeline={stepTimeline}
      showSpeedControl={showSpeedControl}
      hasNarration={!!narrationManifest}
      hasSoundtrack={hasAudibleSoundtrack}
      captionsEnabled={captions}
      captionsVisible={captionsVisible}
      onToggleCaptions={handleToggleCaptions}
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
        {/*
         * Synthesized card steps (ScenarioStep.card) are engine content:
         * the built-in card renders instead of the scenario's render
         * function, which never sees them — cards need no view, no props,
         * no registry entry.
         */}
        {steps[stepIndex]!.card ? (
          <TitleCardView card={steps[stepIndex]!.card!} />
        ) : (
          children(steps[stepIndex]!.data, stepIndex)
        )}

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
         *
         * The caption overlay rides the same portal: like the bar, a caption
         * is player chrome that must hold native pixel size under viewport
         * zoom and camera moves. Rendered before the bar so its z-10 sits
         * beneath the bar's z-20 in source order too.
         *
         * The presenter frame is chrome for the same reason — a presenter
         * must not magnify with camera zooms — and renders first so the
         * caption (z-10) and the bar (z-20) stack above it (z-[5]).
         */}
        {chromeTarget ? (
          createPortal(
            <>
              {presenterFrame}
              {captionOverlay}
              {controlBar}
            </>,
            chromeTarget,
          )
        ) : (
          <>
            {presenterFrame}
            {captionOverlay}
            {controlBar}
          </>
        )}
      </div>

      {narrationManifest && <audio ref={audioRef} preload="none" hidden />}
      {soundtrackAudio.hasMusic && (
        <audio ref={soundtrackAudio.musicRef} preload="none" hidden loop />
      )}
    </div>
  );
}
