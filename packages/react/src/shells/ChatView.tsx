"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  ArrowUp,
  EllipsisVertical,
  Phone,
  Plus,
  Video,
} from "lucide-react";
import { SHELL_HEIGHT_DEFAULT, SHELL_HEIGHT_MIN } from "./tokens.js";

/* -------------------------------------------------------------------------- */
/*  ChatBubble                                                                 */
/* -------------------------------------------------------------------------- */

interface ChatBubbleProps {
  readonly role: "user" | "assistant";
  readonly timestamp?: string;
  readonly children: ReactNode;
}

/**
 * A single chat message bubble for use inside `ChatView`.
 *
 * `role` controls alignment (user = right, assistant = left) and colour
 * (user = iMessage blue, assistant = dark gray).
 */
export function ChatBubble({ role, timestamp, children }: ChatBubbleProps) {
  const isUser = role === "user";

  return (
    <div
      className={`flex flex-col ${isUser ? "items-end" : "items-start"} mb-2`}
    >
      <div
        className="max-w-[80%] px-3 py-2 text-[13px] leading-relaxed text-white"
        style={{
          background: isUser ? "#0b93f6" : "#2a2a2e",
          borderRadius: isUser
            ? "18px 18px 4px 18px"
            : "18px 18px 18px 4px",
        }}
      >
        {children}
      </div>
      {timestamp && (
        <span
          className={`mt-0.5 text-[10px] text-[#666] ${isUser ? "pr-1" : "pl-1"}`}
        >
          {timestamp}
        </span>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  TypingIndicator                                                            */
/* -------------------------------------------------------------------------- */

interface TypingIndicatorProps {
  readonly role?: "assistant";
}

/**
 * Animated three-dot typing indicator, always left-aligned (assistant side).
 */
export function TypingIndicator(_props: TypingIndicatorProps) {
  return (
    <div className="mb-2 flex items-start">
      <div
        className="flex items-center gap-[5px] px-3.5 py-2.5"
        style={{
          background: "#2a2a2e",
          borderRadius: "18px 18px 18px 4px",
        }}
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="inline-block h-[7px] w-[7px] rounded-full bg-[#999]"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.3,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  ChatView                                                                   */
/* -------------------------------------------------------------------------- */

interface ChatViewProps {
  readonly title?: string;
  readonly subtitle?: string;
  readonly avatar?: ReactNode;
  readonly inputPlaceholder?: string;
  readonly contentKey: string;
  readonly slideDirection?: "forward" | "backward";
  readonly children: ReactNode;
}

/**
 * iMessage / WhatsApp-style chat shell for scenario demos.
 *
 * Provides a realistic header bar (avatar, title, action icons), a dark
 * scrollable message area, and a bottom input bar. Compose `ChatBubble`
 * and `TypingIndicator` sub-components as `children` — or any arbitrary
 * React content for tool-call cards, images, etc.
 */
export function ChatView({
  title = "Chat",
  subtitle,
  avatar,
  inputPlaceholder = "Message...",
  contentKey,
  slideDirection,
  children,
}: ChatViewProps) {
  const slideX =
    slideDirection === "forward" ? 24 : slideDirection === "backward" ? -24 : 0;

  const defaultAvatar = (
    <div className="relative">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6]">
        <span className="text-xs font-semibold leading-none text-white">
          {title.charAt(0).toUpperCase()}
        </span>
      </div>
      {/* Online dot */}
      <span className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border-2 border-[#1a1a1a] bg-[#22c55e]" />
    </div>
  );

  return (
    <div
      className="flex flex-col overflow-hidden rounded-lg border border-[#2a2a2e]"
      style={{
        height: `var(--scenar-shell-height, clamp(${SHELL_HEIGHT_MIN}px, 55vh, ${SHELL_HEIGHT_DEFAULT}px))`,
      }}
    >
      {/* Header bar */}
      <div className="flex items-center gap-3 border-b border-[#2a2a2e] bg-[#1a1a1a] px-3 py-2">
        {avatar ?? defaultAvatar}

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-[#e8e8e8]">
            {title}
          </div>
          {subtitle && (
            <div className="truncate text-[11px] text-[#888]">{subtitle}</div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-[#888]" />
          <Video className="h-4 w-4 text-[#888]" />
          <EllipsisVertical className="h-4 w-4 text-[#888]" />
        </div>
      </div>

      {/* Message area */}
      <motion.div
        key={contentKey}
        className="flex flex-1 flex-col justify-end overflow-y-auto px-3 py-3"
        style={{ background: "#0d0d0d" }}
        initial={{ opacity: 0, x: slideX }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {children}
      </motion.div>

      {/* Input bar */}
      <div className="flex items-center gap-2 border-t border-[#2a2a2e] bg-[#1a1a1a] px-3 py-2">
        <Plus className="h-5 w-5 shrink-0 text-[#888]" />
        <div className="flex flex-1 items-center rounded-full bg-[#2a2a2e] px-3 py-1.5">
          <span className="flex-1 text-[13px] text-[#666]">
            {inputPlaceholder}
          </span>
        </div>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0b93f6]">
          <ArrowUp className="h-4 w-4 text-white" strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
}

export type { ChatViewProps, ChatBubbleProps, TypingIndicatorProps };
