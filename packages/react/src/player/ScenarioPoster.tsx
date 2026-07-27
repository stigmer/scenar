import { motion } from "framer-motion";

interface ScenarioPosterProps {
  onPlay: () => void;
  /** Icon component to render in the play button. Defaults to a built-in Play icon. */
  PlayIcon?: React.ComponentType<{ size: number; className?: string }>;
  /**
   * Whether the scenario has narration. When true the poster names the audible
   * payoff ("Play walkthrough with narration") so the viewer knows a click will
   * start sound — browsers block audible autoplay, so the gesture is required.
   */
  hasNarration?: boolean;
}

function DefaultPlayIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function DefaultPauseIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  );
}

function SpeakerIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2a4.5 4.5 0 0 0-2.5-4.03v8.06A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54z" />
    </svg>
  );
}

/**
 * Fire the click handler on Enter/Space so the overlay is operable without a
 * mouse. Space is prevented from scrolling the page.
 */
function activateOnKey(handler: () => void) {
  return (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      handler();
    }
  };
}

/**
 * Poster overlay with a centered play button over a dimming scrim, dismissed
 * on click.
 *
 * No longer rendered by ScenarioPlayer (no overlay ever covers the frame —
 * the always-present control bar is the play affordance at idle) — kept as
 * public API for integrators composing their own player chrome.
 *
 * The scrim is what gives the disc contrast on *light* content — without it
 * a white disc over a white app is invisible and only the triangle survives
 * (the "naked play glyph" defect). The disc itself carries a hairline dark
 * ring and a real drop shadow so it reads as an element on both themes.
 *
 * When the scenario has narration, a small icon-only speaker chip signals
 * that the click starts audio; the full wording lives in the `aria-label`,
 * so screen readers hear exactly what sighted viewers infer.
 */
export function ScenarioPoster({ onPlay, PlayIcon, hasNarration = false }: ScenarioPosterProps) {
  const Icon = PlayIcon ?? DefaultPlayIcon;
  const label = hasNarration ? "Play walkthrough with narration" : "Play demo";
  return (
    <motion.div
      className="absolute inset-0 z-10 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg bg-black/30"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      onClick={(e) => {
        e.stopPropagation();
        onPlay();
      }}
      onKeyDown={activateOnKey(onPlay)}
      role="button"
      tabIndex={0}
      aria-label={label}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white ring-1 ring-black/10 shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition-transform duration-200 hover:scale-105">
        <Icon size={28} className="ml-1 text-neutral-900" />
      </div>
      {hasNarration && (
        <span
          aria-hidden
          className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
        >
          <SpeakerIcon size={14} />
        </span>
      )}
    </motion.div>
  );
}

interface PlaybackBurstProps {
  /** The action the burst confirms — the state playback just entered. */
  kind: "play" | "pause";
  /** Fired when the burst animation finishes, so the host can unmount it. */
  onComplete?: () => void;
}

/**
 * Transient center feedback for a play/pause toggle — the YouTube-style
 * glyph that scales up and fades out where the viewer clicked the content.
 * Purely decorative: `aria-hidden`, no pointer events, unmounted by the
 * host via `onComplete`. This is the only visual the player paints for a
 * pause: the frame itself stays clean, and the control bar (pinned visible
 * while paused) carries the persistent state.
 */
export function PlaybackBurst({ kind, onComplete }: PlaybackBurstProps) {
  const Icon = kind === "play" ? DefaultPlayIcon : DefaultPauseIcon;
  return (
    <div
      aria-hidden
      data-playback-burst={kind}
      // z-[15]: above the content and any overlay (z-10), below the control
      // bar (z-20) so the fading glyph never obscures the transport.
      className="pointer-events-none absolute inset-0 z-[15] flex items-center justify-center"
    >
      <motion.div
        className="flex h-16 w-16 items-center justify-center rounded-full bg-black/60 text-white"
        initial={{ scale: 0.6, opacity: 0.9 }}
        animate={{ scale: 1.4, opacity: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        onAnimationComplete={onComplete}
      >
        <Icon size={28} className={kind === "play" ? "ml-1" : undefined} />
      </motion.div>
    </div>
  );
}

interface ScenarioPauseOverlayProps {
  onResume: () => void;
  PlayIcon?: React.ComponentType<{ size: number; className?: string }>;
}

/**
 * Overlay with a centered play button shown when playback is paused.
 * More subtle than the initial poster so the underlying content remains
 * legible while still giving the user a clear click target to resume.
 * Keyboard-operable.
 *
 * No longer rendered by ScenarioPlayer (a paused frame stays clean; the
 * control bar and PlaybackBurst carry the state) — kept as public API for
 * integrators composing their own player chrome from the headless hooks.
 */
export function ScenarioPauseOverlay({ onResume, PlayIcon }: ScenarioPauseOverlayProps) {
  const Icon = PlayIcon ?? DefaultPlayIcon;
  return (
    <motion.div
      className="absolute inset-0 z-10 flex cursor-pointer items-center justify-center rounded-lg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => {
        e.stopPropagation();
        onResume();
      }}
      onKeyDown={activateOnKey(onResume)}
      role="button"
      tabIndex={0}
      aria-label="Resume demo"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 ring-1 ring-black/10 shadow-[0_6px_18px_rgba(0,0,0,0.3)] transition-transform duration-200 hover:scale-105">
        <Icon size={24} className="ml-1 text-neutral-900" />
      </div>
    </motion.div>
  );
}

interface ScenarioAudioNoticeProps {
  /** Retry audio from within this click — must call the narration unlock. */
  onEnableAudio: () => void;
}

/**
 * Recovery affordance shown when the browser blocked narration audio (autoplay
 * policy) after visual playback already started. Clicking it retries playback
 * inside a fresh user gesture, which is what the browser requires. The visual
 * timeline keeps running underneath; only the audio was held back.
 */
export function ScenarioAudioNotice({ onEnableAudio }: ScenarioAudioNoticeProps) {
  return (
    <motion.button
      type="button"
      className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white shadow-lg transition-transform hover:scale-105"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => {
        e.stopPropagation();
        onEnableAudio();
      }}
    >
      <SpeakerIcon size={14} />
      Tap to enable audio
    </motion.button>
  );
}
