import {
  type MutableRefObject,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  type PresenterManifest,
  type StepTimeline,
  presenterOpacityAt,
} from "@scenar/core";

/**
 * Snap budget for the browser presenter `<video>`, in milliseconds.
 *
 * Measured across Chrome and Safari (T02 Gate 2 spike): steady-state
 * playback noise stays ≤16 ms, while lip-sync error becomes
 * perceptible somewhere in the 45–125 ms range. 50 ms sits above the
 * noise floor and below perception, and a snap-seek is invisible
 * (seek landing is frame-exact in both browsers). Correction is
 * always a hard seek — the evidence does not justify rate-nudging.
 */
const PRESENTER_DRIFT_BUDGET_MS = 50;

/** Safety-net cadence: one drift check per second while playing. */
const DRIFT_CHECK_INTERVAL_MS = 1_000;

interface UsePresenterPlaybackOptions {
  /**
   * Presenter manifest in the EXPANDED step domain (card-padded by
   * `applyTitleCards`) — the same index space as `stepIndex`.
   */
  manifest: PresenterManifest | undefined;
  /** Current active step index in the expanded timeline. */
  stepIndex: number;
  /** Whether the scenario player is currently auto-advancing. */
  playing: boolean;
  /**
   * True until the viewer's first play. Nothing loads at idle — an
   * embed the viewer never plays fetches zero presenter bytes.
   */
  idle: boolean;
  /** Whether narration audio is muted (selects the sync clock below). */
  muted: boolean;
  /** Playback speed multiplier, applied to the video element. */
  playbackRate: number;
  /**
   * The narration `<audio>` element. While narration is audible it is
   * the authoritative clock — the voice the clip is lip-synced to —
   * and corrections align the video to it directly.
   */
  audioRef: RefObject<HTMLAudioElement | null>;
  /**
   * The player's instantaneous scenario position (written per frame by
   * `usePlaybackProgress`). The sync clock while muted, and the time
   * input of the fade-opacity function in every state.
   */
  currentTimeMsRef: MutableRefObject<number>;
  /** Step timeline over the expanded steps (for intra-step math). */
  stepTimeline: StepTimeline;
  /**
   * Disables the hook entirely (video export renders frame-locked
   * media instead; `prefers-reduced-motion` hides the presenter).
   * A disabled hook drives no element and attaches no listeners.
   */
  enabled: boolean;
}

interface UsePresenterPlaybackResult {
  /** Ref for the muted `<video>` element inside the presenter frame. */
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Ref for the frame container; the hook drives its fade opacity. */
  frameRef: RefObject<HTMLDivElement | null>;
  /**
   * Imperatively align the presenter to a seek, mirroring narration's
   * `seekToStep` — called from the player's one seek path so the clip
   * lands on the exact target frame in the same gesture.
   */
  seekToStep: (targetStepIndex: number, offsetMs: number) => void;
}

function stopVideo(video: HTMLVideoElement): void {
  video.pause();
  video.removeAttribute("src");
  video.load();
}

function safePlay(video: HTMLVideoElement): void {
  const result = video.play();
  // Muted video autoplay is universally permitted, but a pause() racing
  // a pending play() still rejects — irrelevant here, so swallow it.
  if (result instanceof Promise) result.catch(() => {});
}

/**
 * Drives the browser presenter `<video>`: one reusable muted element,
 * src-swapped per step (the `useNarrationPlayback` pattern), kept in
 * sync by event-driven corrections rather than a continuous chase
 * loop — the Gate 2 browser measurements showed drift is attached to
 * events (element start, pause/resume, seek, rate change, tab
 * visibility), not accumulated at steady state.
 *
 * Corrections snap `video.currentTime` to the sync clock on: the first
 * presented frame after a src swap (kills Safari's start offset),
 * resume after pause, seek, rate change, and return from a hidden tab
 * (both browsers pause hidden muted video while step timers keep
 * running — this resync is mandatory, step boundaries alone cannot
 * cover it). A once-per-second safety check snaps when drift exceeds
 * {@link PRESENTER_DRIFT_BUDGET_MS}, which alone covers raised-rate
 * accumulation.
 *
 * The hook also drives the frame's fade opacity from the shared pure
 * function (`presenterOpacityAt`) so the browser renders the exact
 * fade the export renders.
 */
export function usePresenterPlayback({
  manifest,
  stepIndex,
  playing,
  idle,
  muted,
  playbackRate,
  audioRef,
  currentTimeMsRef,
  stepTimeline,
  enabled,
}: UsePresenterPlaybackOptions): UsePresenterPlaybackResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const prefetchedRef = useRef(false);

  const entry = enabled ? (manifest?.steps[stepIndex] ?? null) : null;
  const entrySrc = entry?.src ?? null;

  const playingRef = useRef(playing);
  playingRef.current = playing;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const rateRef = useRef(playbackRate);
  rateRef.current = playbackRate;
  const stepIndexRef = useRef(stepIndex);
  stepIndexRef.current = stepIndex;
  const entryRef = useRef(entry);
  entryRef.current = entry;
  const stepTimelineRef = useRef(stepTimeline);
  stepTimelineRef.current = stepTimeline;
  const manifestRef = useRef(manifest);
  manifestRef.current = manifest;

  const seekActiveRef = useRef(false);

  /**
   * The clip's expected media position, in seconds. Narration audible:
   * the audio element's clock (video and audio are two renditions of
   * the same performance). Muted: intra-step scenario time from the
   * step scheduler's clock.
   */
  const syncTargetSec = useCallback(() => {
    const audio = audioRef.current;
    if (!mutedRef.current && audio?.src) return audio.currentTime;
    const stepStart =
      stepTimelineRef.current.stepStartTimesMs[stepIndexRef.current] ?? 0;
    return Math.max(0, currentTimeMsRef.current - stepStart) / 1000;
  }, [audioRef, currentTimeMsRef]);

  const snap = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.src) return;
    video.currentTime = syncTargetSec();
  }, [syncTargetSec]);

  const writeOpacity = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const activeEntry = entryRef.current;
    if (!activeEntry) {
      frame.style.opacity = "0";
      return;
    }
    const stepStart =
      stepTimelineRef.current.stepStartTimesMs[stepIndexRef.current] ?? 0;
    frame.style.opacity = String(
      presenterOpacityAt(
        currentTimeMsRef.current - stepStart,
        activeEntry.durationMs,
      ),
    );
  }, [currentTimeMsRef]);

  /** Snap once the swapped-in clip presents its first frame. */
  const armFirstFrameSnap = useCallback(
    (video: HTMLVideoElement) => {
      // jsdom (tests) and older engines lack rVFC; loadeddata is the
      // nearest "a frame is available" signal there.
      if (typeof video.requestVideoFrameCallback === "function") {
        video.requestVideoFrameCallback(() => snap());
      } else {
        video.addEventListener("loadeddata", () => snap(), { once: true });
      }
    },
    [snap],
  );

  // Step entry: swap the clip for the active step (or stop the element
  // when the step has none). Nothing loads while idle.
  useEffect(() => {
    if (!enabled) return;
    if (seekActiveRef.current) {
      seekActiveRef.current = false;
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    if (idle || !entrySrc) {
      stopVideo(video);
      writeOpacity();
      return;
    }

    video.src = entrySrc;
    video.defaultPlaybackRate = rateRef.current;
    video.load();
    video.playbackRate = rateRef.current;
    writeOpacity();
    if (playingRef.current) safePlay(video);
    armFirstFrameSnap(video);
  }, [enabled, idle, stepIndex, entrySrc, armFirstFrameSnap, writeOpacity]);

  // Pause/resume, with the resume correction (the measured pause →
  // resume gap reaches ~428 ms on Safari). First play also warms the
  // remaining clips over HTTP — nothing was fetched before it.
  useEffect(() => {
    if (!enabled) return;
    const video = videoRef.current;
    if (!video) return;

    if (!playing) {
      if (video.src) video.pause();
      writeOpacity();
      return;
    }

    if (video.src) {
      snap();
      safePlay(video);
    }

    if (!prefetchedRef.current && manifestRef.current) {
      prefetchedRef.current = true;
      for (const clip of manifestRef.current.steps) {
        if (clip?.src) fetch(clip.src).catch(() => {});
      }
    }
  }, [enabled, playing, entrySrc, snap, writeOpacity]);

  // Rate change correction.
  useEffect(() => {
    if (!enabled) return;
    const video = videoRef.current;
    if (!video) return;
    video.defaultPlaybackRate = playbackRate;
    video.playbackRate = playbackRate;
    if (video.src) snap();
  }, [enabled, playbackRate, snap]);

  // Visibility resync: both browsers pause hidden muted video while the
  // step timers keep running; on return the clip is behind by the
  // hidden duration and must re-align and resume.
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      const video = videoRef.current;
      if (!video || !video.src) return;
      snap();
      if (playingRef.current) safePlay(video);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [enabled, snap]);

  // Safety net: one drift check per second while playing. Covers
  // raised-rate accumulation without any rate-specific logic.
  useEffect(() => {
    if (!enabled || !playing || !entrySrc) return;
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || !video.src) return;
      const driftMs = Math.abs(video.currentTime - syncTargetSec()) * 1000;
      if (driftMs > PRESENTER_DRIFT_BUDGET_MS) snap();
    }, DRIFT_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [enabled, playing, entrySrc, snap, syncTargetSec]);

  // Fade opacity, per animation frame while playing. Determinism note:
  // opacity is the shared pure function of scenario time — this loop
  // only samples it; it is not a sync mechanism.
  useEffect(() => {
    if (!enabled || !playing || !entrySrc) return;
    let raf = 0;
    const tick = () => {
      writeOpacity();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, playing, entrySrc, writeOpacity]);

  const seekToStep = useCallback(
    (targetStepIndex: number, offsetMs: number) => {
      if (!enabled) return;
      seekActiveRef.current = true;
      setTimeout(() => {
        seekActiveRef.current = false;
      }, 0);

      const video = videoRef.current;
      if (!video) return;

      const clip = manifestRef.current?.steps[targetStepIndex];
      if (!clip) {
        stopVideo(video);
        if (frameRef.current) frameRef.current.style.opacity = "0";
        return;
      }

      const offsetSec = Math.min(offsetMs, clip.durationMs) / 1000;
      const applySeek = () => {
        video.currentTime = offsetSec;
        if (playingRef.current) safePlay(video);
      };

      if (video.src !== clip.src) {
        video.src = clip.src;
        video.defaultPlaybackRate = rateRef.current;
        video.load();
        video.playbackRate = rateRef.current;
      }
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        applySeek();
      } else {
        video.addEventListener("loadedmetadata", applySeek, { once: true });
      }

      if (frameRef.current) {
        frameRef.current.style.opacity = String(
          presenterOpacityAt(offsetMs, clip.durationMs),
        );
      }
    },
    [enabled],
  );

  // Release the element on player unmount (the narration pattern). A
  // frame that mounts on a later step and unmounts with the player is
  // already out of the DOM by then — nothing further to stop.
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (video) stopVideo(video);
    };
  }, []);

  return { videoRef, frameRef, seekToStep };
}
