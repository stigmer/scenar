import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const SPEED_OPTIONS = [0.5, 1, 1.5, 2] as const;

interface SpeedMenuProps {
  playbackRate: number;
  onSelectSpeed: (speed: number) => void;
}

/**
 * Popover speed selector for playback rate control.
 */
export function SpeedMenu({ playbackRate, onSelectSpeed }: SpeedMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="flex h-6 min-w-[2rem] items-center justify-center rounded px-1 text-[11px] font-medium tabular-nums text-muted-foreground transition-colors hover:text-foreground"
        aria-label={`Playback speed: ${playbackRate}x`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {playbackRate}x
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute bottom-full right-0 mb-1.5 rounded-md border border-border bg-card py-1 shadow-lg"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            role="menu"
            aria-label="Playback speed"
          >
            {SPEED_OPTIONS.map((speed) => (
              <button
                key={speed}
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectSpeed(speed);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 px-3 py-1 text-[11px] tabular-nums transition-colors hover:bg-accent ${
                  speed === playbackRate
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                <span>{speed}x</span>
                {speed === playbackRate && <span className="text-[10px] text-primary">●</span>}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
