import { type RefObject, useCallback, useEffect, useMemo, useRef } from "react";
import {
  type NarrationManifest,
  type ScenarioStep,
  type SfxSound,
  type Soundtrack,
  computeMusicEnvelope,
  computeStepTimeline,
  deriveSfxTimeline,
  musicGainAt,
} from "@scenar/core";

/**
 * Resolved asset URLs for soundtrack playback. Every field is optional —
 * defaults cover the common cases:
 *
 * - `music` defaults to the soundtrack's `musicSrc` as written (absolute
 *   URLs pass through; relative paths resolve against the document, which
 *   is the bundle root inside a packed embed).
 * - `sfx` defaults to the package's own assets resolved via
 *   `import.meta.url` — correct wherever `@scenar/react` is served or
 *   bundled by tooling that understands the pattern. The packed embed
 *   passes explicit bundle-relative URLs instead (its CSP forbids the
 *   inlined data URIs a bundler might otherwise emit).
 */
export interface SoundtrackSources {
  readonly music?: string;
  readonly sfx?: { readonly click: string; readonly keystroke: string };
}

interface UseSoundtrackPlaybackOptions<T> {
  /** The scenario's soundtrack config. `undefined` disables everything. */
  soundtrack: Soundtrack | undefined;
  /** The scenario steps (SFX derive from their interactions). */
  steps: readonly ScenarioStep<T>[];
  /** Narration manifest — drives ducking windows and step durations. */
  narrationManifest: NarrationManifest | undefined;
  /** Current active step index. */
  stepIndex: number;
  /** Whether the player is playing. */
  playing: boolean;
  /**
   * The player's single mute switch (owned by the narration hook). One
   * control silences narration, music, and SFX together.
   */
  muted: boolean;
  /** Playback speed multiplier. Music and SFX scale with it. */
  playbackRate: number;
  /**
   * True under `VideoExportProvider`. The hook is then fully inert — no
   * AudioContext, no timers, no music element — because the Remotion
   * composition places all export audio itself.
   */
  isVideoExport: boolean;
  /**
   * The player's current timeline position in ms, written per frame by
   * `usePlaybackProgress`. Read (never written) for gain automation,
   * music position sync, and mid-step SFX scheduling.
   */
  currentTimeMsRef: RefObject<number>;
  /** Optional asset URL overrides. */
  sources?: SoundtrackSources;
}

interface UseSoundtrackPlaybackResult {
  /**
   * Ref for the hidden music `<audio>` element. The consumer renders it
   * only when `hasMusic` is true.
   */
  musicRef: RefObject<HTMLAudioElement | null>;
  /** Whether a music element should render (music configured, not export). */
  hasMusic: boolean;
  /**
   * Start soundtrack audio from within a user gesture — the same
   * iOS-Safari unlock contract as narration's `unlock()`. Resumes the
   * AudioContext, starts music at the timeline position, and warms the
   * SFX buffers. No-op when muted or nothing is configured.
   */
  unlock: () => void;
  /** Reposition music to a timeline time (loops fold via modulo). */
  seekTo: (timeMs: number) => void;
}

/** Fired SFX play at full sample level; the synthesized assets are pre-leveled. */
const SFX_URLS_BY_SOUND: Record<SfxSound, string> = {
  click: "click.mp3",
  keystroke: "keystroke.mp3",
};

/**
 * Call `play()` and normalize its return into a promise — browsers return
 * a promise that rejects when autoplay is blocked; older engines (and
 * jsdom) return `undefined`. Same contract as narration's `safePlay`.
 */
function safePlay(audio: HTMLAudioElement): Promise<void> {
  const result = audio.play();
  return result instanceof Promise ? result : Promise.resolve();
}

/**
 * The package's own SFX assets, resolved relative to the built module
 * (dist/soundtrack/ → dist/assets/sfx/). Wrapped in try/catch for
 * environments where `import.meta.url` resolution is unavailable.
 */
function defaultSfxUrls(): SoundtrackSources["sfx"] | undefined {
  try {
    return {
      click: new URL(`../assets/sfx/${SFX_URLS_BY_SOUND.click}`, import.meta.url).href,
      keystroke: new URL(`../assets/sfx/${SFX_URLS_BY_SOUND.keystroke}`, import.meta.url).href,
    };
  } catch {
    return undefined;
  }
}

/**
 * Manages soundtrack playback — background music with narration ducking,
 * and interaction sound effects — synced to scenario playback.
 *
 * Encapsulates all soundtrack state so ScenarioPlayer stays focused on
 * step orchestration, mirroring `useNarrationPlayback`'s division of
 * labor. The consumer renders `<audio ref={musicRef} />` when `hasMusic`;
 * this hook drives it.
 *
 * Architecture (per the T01 session design):
 * - Music plays through a media element feeding a Web Audio `GainNode`.
 *   The element supplies streaming decode, looping, and pitch-preserved
 *   `playbackRate` (the narration element's precedent); the gain node
 *   carries ducking/fade automation, which works on iOS where
 *   `element.volume` is ignored. Without Web Audio (jsdom, ancient
 *   browsers) the hook degrades to `element.volume`.
 * - The music level at any instant is `musicGainAt(envelope, t)` — the
 *   same pure `@scenar/core` envelope the video export renders — so both
 *   outputs duck identically and scrubbing lands on the right level.
 * - SFX are the derived `deriveSfxTimeline` events, scheduled on step
 *   entry exactly like the interaction schedulers, played as decoded
 *   `AudioBuffer`s for keystroke polyphony.
 */
export function useSoundtrackPlayback<T>({
  soundtrack,
  steps,
  narrationManifest,
  stepIndex,
  playing,
  muted,
  playbackRate,
  isVideoExport,
  currentTimeMsRef,
  sources,
}: UseSoundtrackPlaybackOptions<T>): UseSoundtrackPlaybackResult {
  const enabled = soundtrack !== undefined && !isVideoExport;
  const hasMusic = enabled && !!soundtrack.musicSrc;
  const sfxEnabled = enabled && soundtrack.sfx === true;

  const musicUrl = hasMusic ? (sources?.music ?? soundtrack.musicSrc) : undefined;

  const musicRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const musicSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const sfxBuffersRef = useRef<Partial<Record<SfxSound, AudioBuffer>> | null>(null);
  const sfxFetchStartedRef = useRef(false);

  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const playbackRateRef = useRef(playbackRate);
  playbackRateRef.current = playbackRate;

  const envelope = useMemo(
    () => (hasMusic ? computeMusicEnvelope(steps, narrationManifest, soundtrack) : null),
    [hasMusic, steps, narrationManifest, soundtrack],
  );

  const sfxTimeline = useMemo(
    () => (sfxEnabled ? deriveSfxTimeline(steps, narrationManifest) : []),
    [sfxEnabled, steps, narrationManifest],
  );

  // Step starts for mid-step SFX scheduling — the audible (unmuted)
  // timeline, the same one the player's progress clock follows.
  const stepTimeline = useMemo(
    () => (sfxEnabled ? computeStepTimeline(steps, narrationManifest) : null),
    [sfxEnabled, steps, narrationManifest],
  );

  const sfxUrls = useMemo(
    () => (sfxEnabled ? (sources?.sfx ?? defaultSfxUrls()) : undefined),
    [sfxEnabled, sources],
  );

  /**
   * Lazily build the Web Audio graph. `createMediaElementSource` may only
   * be called once per element, so the source node is created alongside
   * the context and reused.
   */
  const ensureAudioGraph = useCallback((): AudioContext | null => {
    if (typeof AudioContext === "undefined") return null;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;
    const el = musicRef.current;
    if (el && !musicSourceRef.current) {
      const source = ctx.createMediaElementSource(el);
      const gain = ctx.createGain();
      source.connect(gain);
      gain.connect(ctx.destination);
      musicSourceRef.current = source;
      musicGainRef.current = gain;
    }
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => {});
    }
    return ctx;
  }, []);

  /** Apply the envelope level through the gain node (or element fallback). */
  const applyGain = useCallback(() => {
    if (!envelope) return;
    const level = musicGainAt(envelope, currentTimeMsRef.current);
    if (musicGainRef.current) {
      musicGainRef.current.gain.value = level;
    } else if (musicRef.current) {
      musicRef.current.volume = level;
    }
  }, [envelope, currentTimeMsRef]);

  /** Position the music element at the timeline time, folding loops. */
  const syncMusicPosition = useCallback(
    (timeMs: number) => {
      const el = musicRef.current;
      if (!el) return;
      const apply = () => {
        if (Number.isFinite(el.duration) && el.duration > 0) {
          el.currentTime = (timeMs / 1000) % el.duration;
        }
      };
      if (el.readyState >= HTMLMediaElement.HAVE_METADATA) {
        apply();
      } else {
        el.addEventListener("loadedmetadata", apply, { once: true });
      }
    },
    [],
  );

  /** Warm the SFX buffers: fetch + decode once, cached for the session. */
  const warmSfxBuffers = useCallback(() => {
    if (!sfxEnabled || !sfxUrls || sfxFetchStartedRef.current) return;
    const ctx = ensureAudioGraph();
    if (!ctx) return;
    sfxFetchStartedRef.current = true;

    const load = async (sound: SfxSound, url: string) => {
      try {
        const response = await fetch(url);
        const encoded = await response.arrayBuffer();
        const buffer = await ctx.decodeAudioData(encoded);
        sfxBuffersRef.current = { ...sfxBuffersRef.current, [sound]: buffer };
      } catch {
        // A missing or undecodable asset silently disables that sound —
        // playback itself must never break over a sound effect.
      }
    };
    void load("click", sfxUrls.click);
    void load("keystroke", sfxUrls.keystroke);
  }, [sfxEnabled, sfxUrls, ensureAudioGraph]);

  const playSfx = useCallback(
    (sound: SfxSound) => {
      if (mutedRef.current) return;
      const ctx = audioCtxRef.current;
      const buffer = sfxBuffersRef.current?.[sound];
      if (!ctx || !buffer) return;
      const node = ctx.createBufferSource();
      node.buffer = buffer;
      // Instantaneous ticks are not rate-scaled: at 2x a 35 ms click
      // still reads as a click; only its scheduled moment moves.
      node.connect(ctx.destination);
      node.start();
    },
    [],
  );

  // --- Music transport: follow playing/muted, load lazily, stay synced.
  useEffect(() => {
    const el = musicRef.current;
    if (!el || !hasMusic || !musicUrl) return;

    el.loop = true;
    el.defaultPlaybackRate = playbackRate;
    el.playbackRate = playbackRate;

    if (!playing || muted) {
      el.pause();
      return;
    }

    if (!el.getAttribute("src")) {
      el.src = musicUrl;
      el.load();
    }
    ensureAudioGraph();
    syncMusicPosition(currentTimeMsRef.current);
    applyGain();
    // Autoplay-blocked rejections are expected outside a gesture; the
    // gesture path (`unlock`) is what reliably starts audio, exactly as
    // with narration.
    void safePlay(el).catch(() => {});
  }, [
    playing,
    muted,
    hasMusic,
    musicUrl,
    playbackRate,
    ensureAudioGraph,
    syncMusicPosition,
    applyGain,
    currentTimeMsRef,
  ]);

  // --- Ducking/fade automation: one rAF loop while music is audible.
  useEffect(() => {
    if (!hasMusic || !playing || muted || !envelope) return;
    let frame: number;
    const tick = () => {
      applyGain();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [hasMusic, playing, muted, envelope, applyGain]);

  // --- SFX buffers: warm as soon as sounds could become audible.
  useEffect(() => {
    if (sfxEnabled && !muted) warmSfxBuffers();
  }, [sfxEnabled, muted, warmSfxBuffers]);

  // --- SFX scheduling: on step entry (and resume), schedule this step's
  // remaining events, exactly like the browser interaction scheduler —
  // offsets are step-relative, divided by rate. Events already past the
  // playhead (mid-step resume, seek) are skipped, never replayed.
  useEffect(() => {
    if (!sfxEnabled || !playing || muted || sfxTimeline.length === 0) return;

    const stepStart = stepTimeline?.stepStartTimesMs[stepIndex] ?? 0;
    const elapsedInStep = Math.max(0, currentTimeMsRef.current - stepStart);
    const rate = Math.max(playbackRate, 0.25);
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (const event of sfxTimeline) {
      if (event.stepIndex !== stepIndex) continue;
      const remainingMs = (event.offsetMs - elapsedInStep) / rate;
      if (remainingMs < 0) continue;
      timers.push(setTimeout(() => playSfx(event.sound), remainingMs));
    }

    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [
    sfxEnabled,
    playing,
    muted,
    stepIndex,
    playbackRate,
    sfxTimeline,
    stepTimeline,
    playSfx,
    currentTimeMsRef,
  ]);

  const unlock = useCallback(() => {
    if (!enabled || mutedRef.current) return;
    ensureAudioGraph();
    warmSfxBuffers();
    const el = musicRef.current;
    if (hasMusic && musicUrl && el) {
      if (!el.getAttribute("src")) {
        el.src = musicUrl;
        el.load();
      }
      el.defaultPlaybackRate = playbackRateRef.current;
      el.playbackRate = playbackRateRef.current;
      syncMusicPosition(currentTimeMsRef.current);
      applyGain();
      void safePlay(el).catch(() => {});
    }
  }, [
    enabled,
    hasMusic,
    musicUrl,
    ensureAudioGraph,
    warmSfxBuffers,
    syncMusicPosition,
    applyGain,
    currentTimeMsRef,
  ]);

  const seekTo = useCallback(
    (timeMs: number) => {
      if (!hasMusic) return;
      syncMusicPosition(timeMs);
      applyGain();
    },
    [hasMusic, syncMusicPosition, applyGain],
  );

  // --- Teardown: stop the element and release the audio graph.
  useEffect(() => {
    const el = musicRef.current;
    return () => {
      if (el) {
        el.pause();
        el.removeAttribute("src");
        el.load();
      }
      const ctx = audioCtxRef.current;
      if (ctx) void ctx.close().catch(() => {});
      audioCtxRef.current = null;
      musicGainRef.current = null;
      musicSourceRef.current = null;
      sfxBuffersRef.current = null;
    };
  }, []);

  return { musicRef, hasMusic, unlock, seekTo };
}
