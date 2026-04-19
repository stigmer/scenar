"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { Signal, Wifi, BatteryFull } from "lucide-react";
import { MOBILE_SHELL_HEIGHT_DEFAULT } from "./tokens.js";

interface MobileViewProps {
  readonly statusBar?: {
    readonly time?: string;
    readonly carrier?: string;
  };
  readonly contentKey: string;
  readonly slideDirection?: "forward" | "backward";
  readonly children: ReactNode;
  /** Optional CSS zoom applied to the entire device frame. */
  readonly zoom?: number;
}

/**
 * iPhone 15 Pro device frame for scenario demos.
 *
 * Renders a realistic device shell with titanium-tinted bezel, Dynamic
 * Island, iOS-style status bar (time, signal, WiFi, battery), a
 * full-bleed content area, and a home indicator. The aspect ratio is
 * locked to iPhone 15 Pro proportions (~393×852pt logical); width
 * derives from `--scenar-shell-height` and the device ratio.
 */
export function MobileView({
  statusBar,
  contentKey,
  slideDirection,
  children,
  zoom,
}: MobileViewProps) {
  const slideX =
    slideDirection === "forward" ? 24 : slideDirection === "backward" ? -24 : 0;

  const time = statusBar?.time ?? "9:41";
  const carrier = statusBar?.carrier;

  const DEVICE_RATIO = 393 / 852;

  return (
    <div
      className="flex items-center justify-center"
      style={{
        height: `var(--scenar-shell-height, ${MOBILE_SHELL_HEIGHT_DEFAULT}px)`,
        zoom: zoom ?? undefined,
      }}
    >
      {/* Device frame — titanium bezel */}
      <div
        className="relative flex flex-col overflow-hidden"
        style={{
          height: "100%",
          aspectRatio: `${DEVICE_RATIO}`,
          borderRadius: "44px",
          border: "3px solid #2a2a2e",
          background: "#000",
          boxShadow:
            "inset 0 0 0 1px rgba(255,255,255,0.04), 0 8px 30px rgba(0,0,0,0.5)",
        }}
      >
        {/* Dynamic Island */}
        <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2 pt-[10px]">
          <div
            className="rounded-full bg-black"
            style={{
              width: "100px",
              height: "30px",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.06)",
            }}
          />
        </div>

        {/* Status bar — overlays content */}
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 pt-[14px]">
          {/* Left: time (and optional carrier) */}
          <div className="flex items-center gap-1">
            <span className="text-[13px] font-semibold leading-none text-white">
              {time}
            </span>
            {carrier && (
              <span className="ml-1 text-[11px] leading-none text-white/70">
                {carrier}
              </span>
            )}
          </div>

          {/* Right: cellular + WiFi + battery */}
          <div className="flex items-center gap-[5px]">
            <Signal className="h-[14px] w-[14px] text-white" strokeWidth={2.2} />
            <Wifi className="h-[15px] w-[15px] text-white" strokeWidth={2.2} />
            <BatteryFull className="h-[14px] w-[14px] text-white" strokeWidth={2} />
          </div>
        </div>

        {/* Content area — full bleed behind status bar */}
        <motion.div
          key={contentKey}
          className="relative flex-1 overflow-y-auto"
          style={{ background: "#000" }}
          initial={{ opacity: 0, x: slideX }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {children}
        </motion.div>

        {/* Home indicator */}
        <div className="flex justify-center pb-2 pt-1">
          <div
            className="rounded-full"
            style={{
              width: "110px",
              height: "4px",
              background: "rgba(255,255,255,0.3)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

export type { MobileViewProps };
