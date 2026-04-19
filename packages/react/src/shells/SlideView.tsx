"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Columns2,
  GripHorizontal,
  Maximize2,
  Play,
  SlidersVertical,
  UserPlus,
} from "lucide-react";
import { SLIDE_SHELL_HEIGHT_DEFAULT } from "./tokens.js";

interface SlideViewProps {
  readonly title?: string;
  readonly currentSlide?: number;
  readonly totalSlides?: number;
  readonly speakerNotes?: string;
  readonly contentKey: string;
  readonly slideDirection?: "forward" | "backward";
  readonly children: ReactNode;
}

/**
 * Google Slides / Keynote-style presenter shell for scenario demos.
 *
 * Renders a dark toolbar with traffic-light dots, presentation title,
 * and action buttons; a 16:9 slide canvas centered on a dark stage;
 * a slide counter; and an optional speaker-notes panel below.
 */
export function SlideView({
  title = "Untitled presentation",
  currentSlide = 1,
  totalSlides = 1,
  speakerNotes,
  contentKey,
  slideDirection,
  children,
}: SlideViewProps) {
  const slideX =
    slideDirection === "forward" ? 24 : slideDirection === "backward" ? -24 : 0;

  return (
    <div
      className="flex flex-col overflow-hidden rounded-lg border border-[#3c4043]"
      style={{
        height: `var(--scenar-shell-height, ${SLIDE_SHELL_HEIGHT_DEFAULT}px)`,
      }}
    >
      {/* Title bar / toolbar */}
      <div className="flex items-center border-b border-[#3c4043] bg-[#202124] px-3 py-1.5">
        {/* Traffic lights */}
        <div className="mr-3 flex gap-2">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>

        {/* Presentation title */}
        <span className="min-w-0 flex-1 truncate text-xs text-[#e8eaed]">
          {title}
        </span>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <UserPlus className="h-3.5 w-3.5 text-[#9aa0a6]" />
          <button
            type="button"
            className="flex items-center gap-1 rounded-sm bg-[#1a73e8] px-2.5 py-1 text-[11px] font-medium text-white"
            tabIndex={-1}
          >
            <Play className="h-3 w-3" fill="currentColor" />
            Present
          </button>
        </div>
      </div>

      {/* Stage — dark surround with centered 16:9 canvas */}
      <motion.div
        key={contentKey}
        className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#1a1a1a] p-4"
        initial={{ opacity: 0, x: slideX }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {/* Slide canvas */}
        <div
          className="relative w-full overflow-hidden bg-white"
          style={{
            aspectRatio: "16 / 9",
            maxHeight: "100%",
            border: "1px solid #3c4043",
            boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
          }}
        >
          {children}
        </div>

        {/* Slide counter */}
        <div className="absolute bottom-2 left-4 text-[10px] text-[#9aa0a6]">
          Slide {currentSlide} of {totalSlides}
        </div>
      </motion.div>

      {/* Bottom toolbar hints */}
      <div className="flex items-center justify-between border-t border-[#3c4043] bg-[#202124] px-3 py-1">
        <div className="flex items-center gap-2 text-[10px] text-[#9aa0a6]">
          <Columns2 className="h-3 w-3" />
          <SlidersVertical className="h-3 w-3" />
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[#9aa0a6]">
          <span>100%</span>
          <Maximize2 className="h-3 w-3" />
        </div>
      </div>

      {/* Speaker notes (optional) */}
      {speakerNotes && (
        <div className="flex flex-col border-t border-[#3c4043] bg-[#202124]">
          <div className="flex justify-center py-0.5">
            <GripHorizontal className="h-3.5 w-3.5 text-[#5f6368]" />
          </div>
          <div className="overflow-y-auto px-4 pb-3 font-mono text-[11px] leading-relaxed text-[#bdc1c6]"
            style={{ maxHeight: "80px" }}
          >
            {speakerNotes}
          </div>
        </div>
      )}
    </div>
  );
}

export type { SlideViewProps };
