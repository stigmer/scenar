"use client";

import { motion } from "framer-motion";
import { ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import {
  SHELL_HEIGHT_DEFAULT,
  SHELL_HEIGHT_MIN,
} from "./tokens.js";

export interface TerminalLine {
  readonly type: "prompt" | "output" | "error" | "success" | "blank";
  readonly text: string;
}

interface TerminalViewProps {
  readonly title?: string;
  /** Working directory shown in the prompt. */
  readonly cwd?: string;
  readonly lines: readonly TerminalLine[];
  readonly contentKey: string;
  readonly slideDirection?: "forward" | "backward";
  /** Font size in pixels for the terminal body (default 11). */
  readonly fontSize?: number;
}

const LINE_COLORS: Record<TerminalLine["type"], string> = {
  prompt: "text-[#f8f8f2]",
  output: "text-[#f8f8f2]/70",
  error: "text-[#ff5555]",
  success: "text-[#50fa7b]",
  blank: "",
};

/**
 * macOS Terminal / iTerm2-style terminal emulator for scenario demos.
 *
 * Renders a realistic terminal with a macOS title bar, tab bar, and
 * dark monospace content area. All interior colours are literal
 * (terminals are always dark) — only the outer shell height
 * participates in the `--scenar-shell-height` contract.
 */
export function TerminalView({
  title = "Terminal",
  cwd = "~",
  lines,
  contentKey,
  slideDirection,
  fontSize = 11,
}: TerminalViewProps) {
  const slideX =
    slideDirection === "forward" ? 24 : slideDirection === "backward" ? -24 : 0;

  return (
    <div
      className="flex flex-col overflow-hidden rounded-lg border border-[#3a3a3a]"
      style={{
        height: `var(--scenar-shell-height, clamp(${SHELL_HEIGHT_MIN}px, 55vh, ${SHELL_HEIGHT_DEFAULT}px))`,
      }}
    >
      {/* Title bar */}
      <div className="flex items-center bg-[#323232] px-3 py-1.5">
        <div className="flex gap-2">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>
        <span className="flex-1 text-center text-xs text-[#a0a0a0]">
          {title}
        </span>
        <div className="w-[42px]" />
      </div>

      {/* Tab bar */}
      <div className="flex items-center border-b border-[#1a1a1a] bg-[#2d2d2d]">
        {/* Active tab */}
        <div className="flex items-center gap-1.5 border-r border-[#1a1a1a] bg-[#1e1e1e] px-3 py-1">
          <ChevronRight className="h-3 w-3 text-[#50fa7b]" />
          <span className="text-[11px] text-[#cccccc]">zsh</span>
          <X className="h-3 w-3 text-[#666666]" />
        </div>
        {/* New tab button */}
        <div className="px-2">
          <Plus className="h-3 w-3 text-[#666666]" />
        </div>
        <div className="flex-1" />
        {/* Shell indicator */}
        <div className="flex items-center gap-1 pr-3">
          <ChevronDown className="h-3 w-3 text-[#666666]" />
        </div>
      </div>

      {/* Terminal content */}
      <motion.div
        key={contentKey}
        className="flex-1 overflow-y-auto bg-[#1e1e1e] px-3 py-2 font-mono leading-relaxed"
        style={{ fontSize: `${fontSize}px` }}
        initial={{ opacity: 0, x: slideX }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {lines.map((line, i) => {
          if (line.type === "blank") {
            return <div key={i} className="h-3" />;
          }

          return (
            <div key={i} className={LINE_COLORS[line.type]}>
              {line.type === "prompt" && (
                <span className="mr-1 text-[#bd93f9]">{cwd}</span>
              )}
              {line.type === "prompt" && (
                <span className="mr-1.5 text-[#50fa7b]">❯</span>
              )}
              <span className="whitespace-pre-wrap">{line.text}</span>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}

export type { TerminalViewProps };
