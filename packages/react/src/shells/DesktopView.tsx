"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { SHELL_HEIGHT_DEFAULT } from "./tokens.js";

interface DesktopViewProps {
  /** App title shown in the title bar. */
  readonly title: string;
  /** Unique key for content transition animations. */
  readonly contentKey: string;
  readonly slideDirection?: "forward" | "backward";
  readonly children: ReactNode;
  /** Optional CSS zoom applied to the entire shell (chrome + content). */
  readonly zoom?: number;
}

/**
 * Native desktop app window frame for scenario demos.
 *
 * Renders a macOS-style title bar with traffic-light dots and a centered
 * app title, plus a content area for arbitrary children. Use this to
 * frame SDK components as they appear inside a Tauri / Electron / native
 * desktop application.
 *
 * Shell height is driven by `--scenar-shell-height` (set by `DemoViewport`)
 * with a fallback to `SHELL_HEIGHT_DEFAULT`.
 */
export function DesktopView({
  title,
  contentKey,
  slideDirection,
  children,
  zoom,
}: DesktopViewProps) {
  const slideX =
    slideDirection === "forward" ? 24 : slideDirection === "backward" ? -24 : 0;

  return (
    <div
      className="flex flex-col overflow-hidden rounded-lg border"
      style={{
        height: `var(--scenar-shell-height, ${SHELL_HEIGHT_DEFAULT}px)`,
        borderColor: "var(--scenar-border)",
        zoom: zoom ?? undefined,
      }}
    >
      {/* Title bar */}
      <div
        className="flex shrink-0 items-center px-3 py-2"
        style={{ background: "var(--scenar-chrome, #202124)" }}
      >
        {/* Traffic lights */}
        <div className="flex gap-2">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>

        {/* Centered title */}
        <span className="flex-1 text-center text-xs font-medium text-[#e8eaed]">
          {title}
        </span>

        {/* Balance spacer — same width as traffic lights */}
        <div className="flex gap-2 opacity-0">
          <span className="h-3 w-3" />
          <span className="h-3 w-3" />
          <span className="h-3 w-3" />
        </div>
      </div>

      {/* App content */}
      <motion.div
        key={contentKey}
        className="flex-1 overflow-y-auto"
        style={{ background: "var(--scenar-surface)" }}
        initial={{ opacity: 0, x: slideX }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </div>
  );
}

export type { DesktopViewProps };
