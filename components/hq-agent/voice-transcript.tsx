"use client";

// VoiceTranscript — the live, scrollable running transcript of a voice session.
// User and assistant turns are visually distinct and kept in arrival order.
// Consecutive identical lines from the same role are de-duplicated (streamed
// deltas can otherwise repeat the last line).

import { useEffect, useRef } from "react";

export type Turn = { role: "user" | "assistant"; content: string };

export function VoiceTranscript({ turns }: { turns: Turn[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  // De-dupe consecutive identical (role+content) lines.
  const cleaned: Turn[] = [];
  for (const t of turns) {
    const text = t.content.trim();
    if (!text) continue;
    const prev = cleaned[cleaned.length - 1];
    if (prev && prev.role === t.role && prev.content === text) continue;
    cleaned.push({ role: t.role, content: text });
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [cleaned.length, turns]);

  if (cleaned.length === 0) {
    return (
      <p className="px-2 py-4 text-center text-xs text-ink-faint">
        Your conversation will appear here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {cleaned.map((t, i) => {
        const mine = t.role === "user";
        return (
          <div key={i} className={mine ? "flex justify-end" : "flex justify-start"}>
            <div
              className={[
                "max-w-[86%] rounded-card px-3 py-2 text-sm leading-relaxed shadow-sh1",
                mine ? "bg-cobalt text-white" : "bg-card text-ink",
              ].join(" ")}
            >
              <span
                className={[
                  "mb-0.5 block text-[10px] font-semibold uppercase tracking-wide",
                  mine ? "text-white/70" : "text-ink-faint",
                ].join(" ")}
              >
                {mine ? "You" : "HQ Agent"}
              </span>
              {t.content}
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
