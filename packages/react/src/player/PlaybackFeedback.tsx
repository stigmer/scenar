import { motion } from "framer-motion";

/**
 * Transient playback feedback rendered by ScenarioPlayer: the play/pause
 * burst and the blocked-audio recovery notice. Nothing here ever covers the
 * frame persistently — the always-present control bar carries durable state.
 *
 * (Formerly ScenarioPoster.tsx. `ScenarioPoster` and `ScenarioPauseOverlay`
 * were deleted once the idle poster was retired in 0.8.0 — the control bar
 * is the play affordance in every state, and nothing in the capture-path
 * design revives an overlay. See stigmer/scenar#8.)
 */

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
