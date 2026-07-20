"use client";

// Hq Agent — "Data used" disclosure. Lists the internal data services the
// agent read to ground an answer, with their freshness where known.

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, Database } from "lucide-react";

export type HqAgentSource = {
  service: string;
  dateRange?: string;
  updatedAt?: string | null;
};

function freshness(src: HqAgentSource): string | null {
  const parts: string[] = [];
  if (src.dateRange) parts.push(src.dateRange);
  if (src.updatedAt) {
    const d = new Date(src.updatedAt);
    if (!Number.isNaN(d.getTime())) {
      parts.push(
        `updated ${d.toLocaleDateString([], { day: "numeric", month: "short" })}`,
      );
    }
  }
  return parts.length ? parts.join(" · ") : null;
}

export function HqAgentSourceCard({ sources }: { sources: HqAgentSource[] }) {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  if (!sources.length) return null;

  return (
    <div className="mt-2 border-t border-divider pt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-chip px-1 py-0.5 text-[11px] font-medium text-ink-secondary transition-colors hover:text-ink focus:outline-none focus-visible:border-cobalt focus-visible:ring-2 focus-visible:ring-cobalt/40"
      >
        <Database className="h-3.5 w-3.5" aria-hidden />
        <span>
          Data used · {sources.length} source{sources.length === 1 ? "" : "s"}
        </span>
        <motion.span
          animate={reduced ? {} : { rotate: open ? 180 : 0 }}
          transition={reduced ? { duration: 0 } : { duration: 0.18 }}
          className="inline-flex"
          aria-hidden
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, height: "auto" }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.2 }}
            className="mt-1.5 space-y-1 overflow-hidden"
          >
            {sources.map((src, i) => {
              const meta = freshness(src);
              return (
                <li
                  key={`${src.service}-${i}`}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-chip bg-base-secondary/70 px-2.5 py-1.5"
                >
                  <span className="text-xs font-medium text-ink">{src.service}</span>
                  {meta && (
                    <span className="font-mono text-[10px] text-ink-faint">{meta}</span>
                  )}
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
