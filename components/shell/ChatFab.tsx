"use client";

// ChatFab — floating "Brand Chat" affordance (component-library.md "Shell").
// Chat must be reachable from ANYWHERE once a brand exists (owner decision
// 2026-07), not only via nav. Renders a fixed bottom-right cobalt FAB linking
// to /chat; hides itself on /chat. On mobile inside the app shell the BottomNav
// already carries a Chat tab, so the shell hides the FAB below lg
// (showOnMobile=false); screens OUTSIDE the shell (onboarding scanning) show it
// at all sizes and lift it above the safe-area inset.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare } from "lucide-react";

export function ChatFab({ showOnMobile = false }: { showOnMobile?: boolean }) {
  const pathname = usePathname();
  if (pathname === "/chat" || pathname.startsWith("/chat/")) return null;

  return (
    <Link
      href="/chat"
      aria-label="Open Brand Chat"
      title="Brand Chat"
      className={[
        "fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-40",
        "items-center justify-center rounded-full bg-cobalt p-3.5 text-white shadow-sh1",
        "transition-transform hover:scale-105 active:scale-95",
        showOnMobile ? "flex" : "hidden lg:flex",
      ].join(" ")}
    >
      <MessageSquare className="h-5 w-5" aria-hidden />
    </Link>
  );
}
