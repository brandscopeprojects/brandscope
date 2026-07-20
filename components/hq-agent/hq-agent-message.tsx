"use client";

// Hq Agent — a single message row.
//   User      → plain-text bubble, right, cobalt.
//   Assistant → SAFE markdown bubble, left, card. Raw HTML is ignored
//               (no rehype-raw, no dangerouslySetInnerHTML). Footer carries a
//               timestamp, tool chips, copy, thumbs up/down and a "Data used"
//               disclosure.

import { useMemo, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy, ThumbsDown, ThumbsUp } from "lucide-react";
import { HqAgentSourceCard, type HqAgentSource } from "./hq-agent-source-card";

export type HqAgentMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  modality?: "text" | "voice";
  toolsUsed?: string[];
  sources?: HqAgentSource[];
  reaction?: "up" | "down" | null;
  created_at?: string;
  streaming?: boolean;
};

const TOOL_LABEL: Record<string, string> = {
  brands_overview: "Brands",
  revenue_pnl: "Revenue & P&L",
  operations_status: "Operations",
  agent_performance: "Agent telemetry",
  user_growth: "Users",
};

function timeOf(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── Markdown element → Tailwind mapping. Wide content (tables / code) scrolls
// inside its own overflow container so the page never overflows at 360px. ──
const MD_COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="mt-3 mb-1.5 text-base font-semibold text-ink first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-3 mb-1.5 text-[15px] font-semibold text-ink first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-2.5 mb-1 text-sm font-semibold text-ink first:mt-0">{children}</h3>
  ),
  p: ({ children }) => <p className="my-1.5 leading-relaxed first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-1.5 list-disc space-y-1 pl-5 marker:text-ink-faint">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1.5 list-decimal space-y-1 pl-5 marker:text-ink-faint">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-cobalt underline decoration-cobalt/40 underline-offset-2 hover:decoration-cobalt"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-divider pl-3 text-ink-secondary">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-divider" />,
  code: ({ className, children }) => {
    const isBlock = /language-/.test(className ?? "");
    if (isBlock) {
      return (
        <code className={`${className ?? ""} font-mono text-[12px] leading-relaxed`}>
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-base-secondary px-1 py-0.5 font-mono text-[12px] text-ink">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-card border border-divider bg-base-secondary/70">
      <pre className="min-w-0 p-3 font-mono text-[12px] leading-relaxed text-ink">{children}</pre>
    </div>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-card border border-divider">
      <table className="w-full border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-base-secondary/70">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-divider last:border-0">{children}</tr>,
  th: ({ children }) => (
    <th className="whitespace-nowrap px-3 py-1.5 font-semibold text-ink">{children}</th>
  ),
  td: ({ children }) => <td className="px-3 py-1.5 align-top text-ink-secondary">{children}</td>,
};

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="text-sm text-ink [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS} skipHtml>
        {content}
      </ReactMarkdown>
    </div>
  );
}

function FooterButton({
  onClick,
  label,
  active,
  activeClass,
  children,
}: {
  onClick: () => void;
  label: string;
  active?: boolean;
  activeClass?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={[
        "rounded-chip p-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cobalt/40",
        active
          ? activeClass ?? "text-cobalt"
          : "text-ink-faint hover:bg-base-secondary hover:text-ink-secondary",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function HqAgentMessageView({
  message,
  onReact,
}: {
  message: HqAgentMessage;
  onReact: (messageId: string, reaction: "up" | "down" | null) => void;
}) {
  const reduced = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const mine = message.role === "user";
  const tools = useMemo(
    () => Array.from(new Set(message.toolsUsed ?? [])),
    [message.toolsUsed],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 480, damping: 38 }}
      className={mine ? "flex flex-col items-end" : "flex flex-col items-start"}
    >
      <div
        className={[
          "max-w-[86%] px-3.5 py-2.5 shadow-sh1 md:max-w-[75%]",
          mine
            ? "whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-cobalt text-sm leading-relaxed text-white"
            : "min-w-0 rounded-2xl rounded-bl-md bg-card text-ink",
        ].join(" ")}
      >
        {mine ? (
          message.content
        ) : message.streaming && !message.content ? (
          <span className="flex items-center gap-1 py-1" aria-label="Assistant is typing">
            {[0, 1, 2].map((d) => (
              <motion.span
                key={d}
                className="h-1.5 w-1.5 rounded-full bg-ink-faint"
                animate={reduced ? {} : { opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: d * 0.18 }}
              />
            ))}
          </span>
        ) : (
          <>
            <AssistantMarkdown content={message.content} />
            {message.streaming && (
              <span
                className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-[2px] animate-pulse bg-current align-middle"
                aria-hidden
              />
            )}
          </>
        )}

        {/* Assistant footer — sources disclosure lives inside the bubble. */}
        {!mine && !message.streaming && (message.sources?.length ?? 0) > 0 && (
          <HqAgentSourceCard sources={message.sources!} />
        )}
      </div>

      {/* Assistant meta row: timestamp, tool chips, actions. */}
      {!mine && !message.streaming && (
        <div className="mt-1 flex w-full max-w-[86%] flex-wrap items-center gap-1.5 pl-1 md:max-w-[75%]">
          {message.created_at && (
            <span className="font-mono text-[10px] text-ink-faint">
              {timeOf(message.created_at)}
            </span>
          )}
          {tools.map((t) => (
            <span
              key={t}
              className="rounded-full bg-base-secondary px-2 py-0.5 text-[10px] font-medium text-ink-faint"
            >
              {TOOL_LABEL[t] ?? t}
            </span>
          ))}
          <div className="ml-auto flex items-center gap-0.5">
            <FooterButton onClick={() => void copy()} label={copied ? "Copied" : "Copy answer"} active={copied}>
              {copied ? (
                <Check className="h-3.5 w-3.5 text-opportunity" aria-hidden />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden />
              )}
            </FooterButton>
            {message.id && (
              <>
                <FooterButton
                  onClick={() => onReact(message.id!, message.reaction === "up" ? null : "up")}
                  label="Good answer"
                  active={message.reaction === "up"}
                >
                  <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
                </FooterButton>
                <FooterButton
                  onClick={() => onReact(message.id!, message.reaction === "down" ? null : "down")}
                  label="Bad answer"
                  active={message.reaction === "down"}
                  activeClass="text-urgent"
                >
                  <ThumbsDown className="h-3.5 w-3.5" aria-hidden />
                </FooterButton>
              </>
            )}
          </div>
        </div>
      )}

      {/* User timestamp */}
      {mine && message.created_at && (
        <span className="mt-1 pr-1 font-mono text-[10px] text-ink-faint">
          {timeOf(message.created_at)}
        </span>
      )}
    </motion.div>
  );
}
