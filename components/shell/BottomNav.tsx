"use client";

// BottomNav — fixed 5-item mobile navigation bar (component-library.md "Mobile",
// ui-constraints §11.2). Visible below `lg` only; the NavSidebar owns desktop.
// Sections: Dashboard, Actions (action plan), Intelligence (any intelligence
// route), Chat, Admin. Active section derives from usePathname() — mounted once
// in AppShell, no per-page props. ≥44px touch targets; safe-area inset padding
// so the bar clears the iPhone home indicator.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListChecks,
  Globe2,
  MessageSquare,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { NAV_GROUPS } from "./nav-items";

type Section = "dashboard" | "actions" | "intelligence" | "chat" | "admin";

// Intelligence routes come from the canonical nav config (single source).
const INTELLIGENCE_HREFS: string[] = (
  NAV_GROUPS.find((g) => g.heading === "Intelligence")?.items ?? []
).map((i) => i.href);

const ITEMS: { section: Section; label: string; href: string; icon: LucideIcon }[] = [
  { section: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { section: "actions", label: "Actions", href: "/action-plan", icon: ListChecks },
  { section: "intelligence", label: "Intel", href: "/market-intel", icon: Globe2 },
  { section: "chat", label: "Chat", href: "/chat", icon: MessageSquare },
  { section: "admin", label: "Admin", href: "/admin/settings", icon: Settings },
];

function matches(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function activeSection(pathname: string): Section | null {
  if (matches(pathname, "/dashboard")) return "dashboard";
  if (
    matches(pathname, "/action-plan") ||
    matches(pathname, "/assets") ||
    matches(pathname, "/performance") ||
    matches(pathname, "/reports")
  ) {
    return "actions";
  }
  if (INTELLIGENCE_HREFS.some((h) => matches(pathname, h)) || matches(pathname, "/competitors")) {
    return "intelligence";
  }
  if (matches(pathname, "/chat")) return "chat";
  if (matches(pathname, "/admin")) return "admin";
  return null;
}

export function BottomNav() {
  const pathname = usePathname();
  const active = activeSection(pathname);

  return (
    <nav
      aria-label="Primary mobile"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-divider bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {ITEMS.map(({ section, label, href, icon: Icon }) => {
          const isActive = section === active;
          return (
            <li key={section} className="flex-1">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-chip px-1 py-1.5 text-[11px] font-medium transition-colors",
                  isActive ? "text-cobalt" : "text-ink-faint hover:text-ink-secondary",
                ].join(" ")}
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
