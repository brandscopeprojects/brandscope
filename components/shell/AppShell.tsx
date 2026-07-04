"use client";

// AppShell — the authenticated brand-facing frame (ui-constraints §11.2). Owns the
// mobile nav open/close state, renders the fixed NavSidebar + a top header with the
// brand/market context and sign-out, and insets the page content to the left rail
// on desktop. Server layout passes brand context in; pages render as `children`.

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { NavSidebar } from "@/components/shell/NavSidebar";
import { BottomNav } from "@/components/shell/BottomNav";
import { ChatFab } from "@/components/shell/ChatFab";
import { marketLabel } from "@/lib/format";

export function AppShell({
  brandName,
  markets,
  children,
}: {
  brandName: string;
  markets: string[];
  children: React.ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-base">
      <NavSidebar open={navOpen} onNavigate={() => setNavOpen(false)} />

      {/* Mobile backdrop */}
      {navOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-30 bg-ink/30 lg:hidden"
        />
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-divider bg-base/90 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setNavOpen((o) => !o)}
              aria-label={navOpen ? "Close navigation" : "Open navigation"}
              className="rounded-chip p-1.5 text-ink-secondary hover:bg-base-secondary hover:text-ink lg:hidden"
            >
              {navOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-sm font-bold text-ink">{brandName}</span>
              {markets.length > 0 && (
                <span className="text-xs text-ink-secondary">
                  · {markets.map(marketLabel).join(", ")}
                </span>
              )}
            </div>
          </div>

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-chip px-3 py-1.5 text-sm text-ink-secondary transition-colors hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </header>

        <div className="mx-auto max-w-[1400px] px-4 py-6 pb-24 md:px-6 md:py-8 lg:pb-8">
          {children}
        </div>
      </div>

      <BottomNav />
      <ChatFab />
    </div>
  );
}
