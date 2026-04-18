import { motion } from "framer-motion";

interface ScenarioPosterProps {
  onPlay: () => void;
  /** Icon component to render in the play button. Defaults to a built-in Play icon. */
  PlayIcon?: React.ComponentType<{ size: number; className?: string }>;
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

/**
 * Poster overlay with a centered play button. Shown before
 * playback starts and dismissed on click.
 */
export function ScenarioPoster({ onPlay, PlayIcon }: ScenarioPosterProps) {
  const Icon = PlayIcon ?? DefaultPlayIcon;
  return (
    <motion.div
      className="absolute inset-0 z-10 flex cursor-pointer items-center justify-center rounded-lg bg-black/40 backdrop-blur-[2px]"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      onClick={(e) => {
        e.stopPropagation();
        onPlay();
      }}
      role="button"
      aria-label="Play demo"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 ring-1 ring-white/30 shadow-[0_0_20px_rgba(255,255,255,0.25)] transition-transform hover:scale-110">
        <Icon size={28} className="ml-1 text-neutral-900" />
      </div>
    </motion.div>
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
 */
export function ScenarioPauseOverlay({ onResume, PlayIcon }: ScenarioPauseOverlayProps) {
  const Icon = PlayIcon ?? DefaultPlayIcon;
  return (
    <motion.div
      className="absolute inset-0 z-10 flex cursor-pointer items-center justify-center rounded-lg bg-black/30"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => {
        e.stopPropagation();
        onResume();
      }}
      role="button"
      aria-label="Resume demo"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/80 ring-1 ring-white/30 shadow-[0_0_20px_rgba(255,255,255,0.25)] transition-transform hover:scale-110">
        <Icon size={24} className="ml-1 text-neutral-900" />
      </div>
    </motion.div>
  );
}
