"use client";

// Hq Agent — the scrolling thread. Auto-scrolls to the newest message ONLY
// when the user is already near the bottom, so reading older messages is never
// interrupted by an incoming stream.

import { useEffect, useLayoutEffect, useRef } from "react";
import { HqAgentMessageView, type HqAgentMessage } from "./hq-agent-message";

const NEAR_BOTTOM_PX = 80;

export function HqAgentMessageList({
  messages,
  error,
  onReact,
}: {
  messages: HqAgentMessage[];
  error?: string | null;
  onReact: (messageId: string, reaction: "up" | "down" | null) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);

  // Track whether the viewport is pinned near the bottom.
  const updateNearBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    nearBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
  };

  // On every message change (new bubble OR streamed text), only follow the
  // stream if the user hasn't scrolled up.
  useLayoutEffect(() => {
    if (nearBottomRef.current) {
      endRef.current?.scrollIntoView({ block: "end" });
    }
  }, [messages]);

  // Establish initial pinned state.
  useEffect(() => {
    updateNearBottom();
  }, []);

  return (
    <div
      ref={scrollRef}
      onScroll={updateNearBottom}
      className="flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-3 py-4 md:px-6"
    >
      {messages.map((m, i) => (
        <HqAgentMessageView key={m.id ?? `i-${i}`} message={m} onReact={onReact} />
      ))}
      {error && (
        <p
          role="alert"
          className="rounded-card border border-urgent/30 bg-urgent/5 px-3 py-2 text-sm text-urgent"
        >
          {error}
        </p>
      )}
      <div ref={endRef} />
    </div>
  );
}
