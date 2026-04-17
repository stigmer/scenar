import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import type { NarrationManifest } from "@scenar/core";

interface UseNarrationPlaybackOptions {
  /** Narration manifest mapping step indices to audio clips. */
  manifest: NarrationManifest | undefined;
  /** Current active step index in the scenario timeline. */
  stepIndex: number;
  /** Whether the scenario player is currently auto-advancing. */
  playing: boolean;
  /** Initial muted state (default true). Set false for video export. */
  initialMuted?: boolean;
  /**
   * Playback speed multiplier (default 1). Applied to the audio
   * element's native playbackRate so narration stays in sync with
   * the accelerated step timers.
   */
  playbackRate?: number;
  /**
   * Fired when the current narration clip finishes playing (via the
   * HTMLMediaElement `ended` event). ScenarioPlayer uses this to drive
   * step advancement instead of a duration-based timeout.
   */
  onClipEnded?: () => void;
}

interface UseNarrationPlaybackResult {
  /** Whether narration audio is muted (true by default). */
  muted: boolean;
  /** Toggle mute state. When unmuting, plays the current step's audio. */
  toggleMute: () => void;
  /** Ref to attach to a hidden <audio> element rendered by ScenarioPlayer. */
  audioRef: RefObject<HTMLAudioElement | null>;
}

function safePlay(audio: HTMLAudioElement): void {
  const result = audio.play();
  if (result !== undefined) {
    result.catch(() => {});
  }
}

function playClip(audio: HTMLAudioElement, src: string, rate = 1): void {
  audio.src = src;
  audio.defaultPlaybackRate = rate;
  audio.load();
  audio.playbackRate = rate;
  safePlay(audio);
}

function stopAudio(audio: HTMLAudioElement): void {
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
}

function prefetchManifestClips(manifest: NarrationManifest): void {
  for (const entry of manifest.steps) {
    if (entry?.src) {
      fetch(entry.src).catch(() => {});
    }
  }
}

/**
 * Manages narration audio playback synced to scenario step progression.
 *
 * Encapsulates all audio state so ScenarioPlayer stays focused on step
 * orchestration. The hook manages a single reusable `<audio>` element
 * via ref — the consumer renders `<audio ref={audioRef} />` and this
 * hook drives it.
 */
export function useNarrationPlayback({
  manifest,
  stepIndex,
  playing,
  initialMuted = true,
  playbackRate = 1,
  onClipEnded,
}: UseNarrationPlaybackOptions): UseNarrationPlaybackResult {
  const [muted, setMuted] = useState(initialMuted);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prefetchedRef = useRef(false);

  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const playingRef = useRef(playing);
  playingRef.current = playing;

  const onClipEndedRef = useRef(onClipEnded);
  onClipEndedRef.current = onClipEnded;

  const playbackRateRef = useRef(playbackRate);
  playbackRateRef.current = playbackRate;

  const entry = manifest?.steps[stepIndex] ?? null;
  const entrySrc = entry?.src ?? null;

  useEffect(() => {
    if (!manifest || initialMuted || prefetchedRef.current) return;
    prefetchManifestClips(manifest);
    prefetchedRef.current = true;
  }, [manifest, initialMuted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !manifest) return;

    const handleEnded = () => onClipEndedRef.current?.();
    audio.addEventListener("ended", handleEnded);
    return () => audio.removeEventListener("ended", handleEnded);
  }, [manifest]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !manifest) return;

    if (mutedRef.current || !entrySrc || !playingRef.current) {
      stopAudio(audio);
      return;
    }

    playClip(audio, entrySrc, playbackRateRef.current);
  }, [stepIndex, entrySrc, manifest]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !manifest || mutedRef.current) return;

    if (!playing) {
      audio.pause();
    } else if (entrySrc) {
      if (audio.src) {
        safePlay(audio);
      } else {
        playClip(audio, entrySrc, playbackRateRef.current);
      }
    }
  }, [playing, entrySrc, manifest]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      const audio = audioRef.current;
      if (!audio) return next;

      if (next) {
        stopAudio(audio);
      } else {
        if (manifest && !prefetchedRef.current) {
          prefetchManifestClips(manifest);
          prefetchedRef.current = true;
        }
        if (entrySrc) {
          playClip(audio, entrySrc, playbackRateRef.current);
        }
      }

      return next;
    });
  }, [entrySrc, manifest]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.defaultPlaybackRate = playbackRate;
    audio.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (audio) stopAudio(audio);
    };
  }, []);

  return { muted, toggleMute, audioRef };
}
