"use client";

// Lightweight status auto-refresh for the Knowledge Base. While any visible
// document is still pending/processing, poll the server component (router.refresh)
// every 8s so embedding completion appears without a manual reload. Stops when
// nothing is pending, when the tab is hidden, and on unmount. No WebSocket/realtime
// infrastructure — just a bounded interval.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 8000;

export function KnowledgeAutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        router.refresh();
      }
    };
    timer = setInterval(tick, POLL_MS);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [active, router]);

  return null;
}
