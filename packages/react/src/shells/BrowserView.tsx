"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  EllipsisVertical,
  Globe,
  Lock,
  Plus,
  RotateCcw,
  Star,
  X,
} from "lucide-react";
import { BROWSER_SHELL_HEIGHT_DEFAULT } from "./tokens.js";

interface BrowserViewProps {
  readonly url: string;
  readonly contentKey: string;
  readonly slideDirection?: "forward" | "backward";
  readonly children: ReactNode;
  /** Optional CSS zoom applied to the entire shell (chrome + content). */
  readonly zoom?: number;
}

function tabTitle(url: string): string {
  const cleaned = url.replace(/^https?:\/\//, "");
  const host = cleaned.split("/")[0] ?? cleaned;
  return host;
}

/**
 * Chrome-style browser chrome for scenario demos.
 *
 * Renders a realistic tab strip with traffic-light dots, an active tab,
 * a navigation toolbar with back/forward/reload and address bar, and
 * a content area for arbitrary children.
 *
 * Shell height is driven by `--scenar-shell-height` (set by `DemoViewport`)
 * with a fallback to `BROWSER_SHELL_HEIGHT_DEFAULT`.
 */
export function BrowserView({
  url,
  contentKey,
  slideDirection,
  children,
  zoom,
}: BrowserViewProps) {
  const slideX =
    slideDirection === "forward" ? 24 : slideDirection === "backward" ? -24 : 0;

  return (
    <div
      className="flex flex-col overflow-hidden rounded-lg border"
      style={{
        height: `var(--scenar-shell-height, ${BROWSER_SHELL_HEIGHT_DEFAULT}px)`,
        borderColor: "var(--scenar-border)",
        zoom: zoom ?? undefined,
      }}
    >
      {/* Tab strip */}
      <div className="flex items-center bg-[#202124] px-2 pt-1.5">
        {/* Traffic lights */}
        <div className="mr-3 flex gap-2 pl-1.5">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>

        {/* Active tab — bg matches toolbar so the tab visually flows into it */}
        <div className="flex items-center gap-1.5 rounded-t-lg bg-[#35363a] px-3 py-1.5">
          <Globe className="h-3.5 w-3.5 shrink-0 text-[#9aa0a6]" />
          <span className="max-w-[180px] truncate text-xs text-[#e8eaed]">
            {tabTitle(url)}
          </span>
          <X className="h-3 w-3 shrink-0 text-[#9aa0a6]" />
        </div>

        {/* New tab button */}
        <Plus className="ml-1 h-3.5 w-3.5 shrink-0 text-[#9aa0a6]" />

        <div className="flex-1" />

        {/* Profile avatar */}
        <div className="mr-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#5f6368]">
          <span className="text-[8px] font-medium leading-none text-[#e8eaed]">
            J
          </span>
        </div>
      </div>

      {/* Navigation toolbar */}
      <div className="flex items-center gap-2 bg-[#35363a] px-2 py-1">
        {/* Nav buttons */}
        <div className="flex items-center gap-1">
          <ChevronLeft className="h-4 w-4 text-[#9aa0a6]" />
          <ChevronRight className="h-4 w-4 text-[#9aa0a6]" />
          <RotateCcw className="ml-0.5 h-3.5 w-3.5 text-[#9aa0a6]" />
        </div>

        {/* Address bar */}
        <div className="flex flex-1 items-center gap-1.5 rounded-full bg-[#202124] px-3 py-1.5">
          <Lock className="h-3 w-3 shrink-0 text-[#9aa0a6]" />
          <span className="truncate text-xs text-[#bdc1c6]">{url}</span>
        </div>

        {/* Toolbar right — star + extension + kebab menu */}
        <div className="flex items-center gap-1">
          <Star className="h-3.5 w-3.5 text-[#9aa0a6]" />
          <div className="h-4 w-4 rounded-full bg-[#5f6368]" />
          <EllipsisVertical className="h-4 w-4 text-[#9aa0a6]" />
        </div>
      </div>

      {/* Page content */}
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

export type { BrowserViewProps };
