"use client";

import { motion } from "framer-motion";
import { Plus, Send, X } from "lucide-react";
import { SHELL_HEIGHT_DEFAULT, SHELL_HEIGHT_MIN } from "./tokens.js";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface APIClientViewProps {
  readonly method: HttpMethod;
  readonly url: string;
  readonly requestBody?: string;
  readonly responseBody?: string;
  readonly statusCode?: number;
  readonly statusText?: string;
  readonly responseTimeMs?: number;
  readonly responseSize?: string;
  readonly activeRequestTab?: "params" | "headers" | "body" | "auth";
  readonly activeResponseTab?: "body" | "headers" | "cookies";
  readonly contentKey: string;
  readonly slideDirection?: "forward" | "backward";
}

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "#49cc90",
  POST: "#fca130",
  PUT: "#61affe",
  PATCH: "#e8a838",
  DELETE: "#f93e3e",
};

const STATUS_REASONS: Record<number, string> = {
  200: "OK",
  201: "Created",
  204: "No Content",
  301: "Moved Permanently",
  302: "Found",
  304: "Not Modified",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  409: "Conflict",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
};

function statusBadgeColor(code: number): string {
  if (code >= 200 && code < 300) return "#49cc90";
  if (code >= 300 && code < 400) return "#fca130";
  return "#f93e3e";
}

function CodeBlock({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="flex flex-1 overflow-y-auto bg-[#1e1e1e] font-mono text-[11px] leading-[1.6]">
      {/* Line numbers */}
      <div className="sticky left-0 shrink-0 select-none bg-[#1e1e1e] py-1.5 pr-2 text-right" aria-hidden>
        {lines.map((_, i) => (
          <div key={i} className="px-2 text-[#5f6368]">{i + 1}</div>
        ))}
      </div>
      {/* Content */}
      <div className="min-w-0 flex-1 py-1.5 pr-3">
        {lines.map((line, i) => (
          <div key={i} className="whitespace-pre text-[#d4d4d4]">
            {line || "\u00A0"}
          </div>
        ))}
      </div>
    </div>
  );
}

function TabBar({
  tabs,
  activeTab,
}: {
  tabs: readonly string[];
  activeTab: string;
}) {
  return (
    <div className="flex border-b border-[#3a3a3a] bg-[#2c2c2c]">
      {tabs.map((tab) => (
        <div
          key={tab}
          className={`px-3 py-1.5 text-[11px] ${
            tab.toLowerCase() === activeTab
              ? "border-b-2 border-[#ff6c37] text-[#e8eaed]"
              : "text-[#9aa0a6]"
          }`}
        >
          {tab}
        </div>
      ))}
    </div>
  );
}

/**
 * Postman-style REST/API client shell for scenario demos.
 *
 * Renders a dark title bar with a tab, a colour-coded method badge with
 * URL input and Send button, tabbed request/response panes with line-
 * numbered code blocks, a status badge with response metadata, and a
 * bottom status bar.
 */
export function APIClientView({
  method,
  url,
  requestBody,
  responseBody,
  statusCode,
  statusText,
  responseTimeMs,
  responseSize,
  activeRequestTab = "body",
  activeResponseTab = "body",
  contentKey,
  slideDirection,
}: APIClientViewProps) {
  const slideX =
    slideDirection === "forward" ? 24 : slideDirection === "backward" ? -24 : 0;

  const resolvedStatusText =
    statusText ?? (statusCode ? (STATUS_REASONS[statusCode] ?? "") : "");
  const hasResponse = responseBody !== undefined || statusCode !== undefined;

  return (
    <div
      className="flex flex-col overflow-hidden rounded-lg border border-[#3a3a3a]"
      style={{
        height: `var(--scenar-shell-height, clamp(${SHELL_HEIGHT_MIN}px, 55vh, ${SHELL_HEIGHT_DEFAULT}px))`,
      }}
    >
      {/* Title bar */}
      <div className="flex items-center bg-[#1c1c1c] px-2 pt-1.5">
        {/* Traffic lights */}
        <div className="mr-3 flex gap-2 pl-1.5">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>

        {/* Active tab */}
        <div className="flex items-center gap-1.5 rounded-t-lg bg-[#2c2c2c] px-3 py-1.5">
          <span
            className="text-[10px] font-bold"
            style={{ color: METHOD_COLORS[method] }}
          >
            {method}
          </span>
          <span className="max-w-[200px] truncate text-xs text-[#e8eaed]">
            {tabRequestName(url)}
          </span>
          <X className="h-3 w-3 shrink-0 text-[#5f6368]" />
        </div>

        <Plus className="ml-1 h-3.5 w-3.5 shrink-0 text-[#5f6368]" />
        <div className="flex-1" />
      </div>

      {/* Request bar */}
      <div className="flex items-center gap-2 bg-[#2c2c2c] px-3 py-2">
        {/* Method badge */}
        <span
          className="rounded px-2 py-0.5 text-[11px] font-bold"
          style={{
            color: METHOD_COLORS[method],
            background: `${METHOD_COLORS[method]}15`,
          }}
        >
          {method}
        </span>

        {/* URL input */}
        <div className="flex flex-1 items-center rounded bg-[#1c1c1c] px-3 py-1.5">
          <span className="truncate text-xs text-[#bdc1c6]">{url}</span>
        </div>

        {/* Send button */}
        <button
          type="button"
          className="flex items-center gap-1 rounded bg-[#3b82f6] px-3 py-1.5 text-[11px] font-medium text-white"
          tabIndex={-1}
        >
          <Send className="h-3 w-3" />
          Send
        </button>
      </div>

      {/* Main content — animated */}
      <motion.div
        key={contentKey}
        className="flex flex-1 flex-col overflow-hidden"
        initial={{ opacity: 0, x: slideX }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {/* Request section */}
        {requestBody !== undefined && (
          <div className="flex flex-col" style={{ flex: hasResponse ? "0 0 auto" : "1" }}>
            <TabBar
              tabs={["Params", "Headers", "Body", "Auth"]}
              activeTab={activeRequestTab}
            />
            <div className="overflow-y-auto" style={{ maxHeight: hasResponse ? "120px" : undefined, flex: hasResponse ? undefined : 1 }}>
              <CodeBlock content={requestBody} />
            </div>
          </div>
        )}

        {/* Response section */}
        {hasResponse && (
          <div className="flex flex-1 flex-col overflow-hidden border-t border-[#3a3a3a]">
            {/* Response header: tabs + status badge */}
            <div className="flex items-center justify-between bg-[#2c2c2c]">
              <div className="flex">
                {["Body", "Headers", "Cookies"].map((tab) => (
                  <div
                    key={tab}
                    className={`px-3 py-1.5 text-[11px] ${
                      tab.toLowerCase() === activeResponseTab
                        ? "border-b-2 border-[#ff6c37] text-[#e8eaed]"
                        : "text-[#9aa0a6]"
                    }`}
                  >
                    {tab}
                  </div>
                ))}
              </div>

              {/* Status badge + metadata */}
              <div className="flex items-center gap-3 pr-3">
                {statusCode !== undefined && (
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                    style={{
                      color: statusBadgeColor(statusCode),
                      background: `${statusBadgeColor(statusCode)}15`,
                    }}
                  >
                    {statusCode} {resolvedStatusText}
                  </span>
                )}
                {responseTimeMs !== undefined && (
                  <span className="text-[10px] text-[#9aa0a6]">
                    {responseTimeMs}ms
                  </span>
                )}
                {responseSize && (
                  <span className="text-[10px] text-[#9aa0a6]">
                    {responseSize}
                  </span>
                )}
              </div>
            </div>

            {/* Response body */}
            {responseBody !== undefined && (
              <div className="flex-1 overflow-hidden">
                <CodeBlock content={responseBody} />
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Status bar */}
      <div className="flex items-center justify-between border-t border-[#3a3a3a] bg-[#1c1c1c] px-3 py-0.5">
        <span className="text-[10px] text-[#5f6368]">Ready</span>
        <span className="text-[10px] text-[#5f6368]">
          {method} Request
        </span>
      </div>
    </div>
  );
}

function tabRequestName(url: string): string {
  const cleaned = url.replace(/^https?:\/\//, "");
  const pathStart = cleaned.indexOf("/");
  if (pathStart === -1) return cleaned;
  return cleaned.substring(pathStart);
}

export type { APIClientViewProps, HttpMethod };
