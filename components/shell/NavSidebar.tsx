"use client";

// NavSidebar — the brand-facing left rail (ui-constraints §11.2). Wordmark at top,
// grouped nav with the active route in cobalt (cobalt = "this is you / primary").
// Collapsible on mobile via a controlled `open` prop owned by the shell header.
// Active state uses usePathname; a route matches when the pathname equals or
// nests under the item href (so /competitors/[id] keeps no item active by design).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS } from "@/components/shell/nav-items";

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavSidebar({
  open = false,
  onNavigate,
}: {
  open?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav
      className={[
        "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-divider bg-card",
        "transition-transform lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      ].join(" ")}
      aria-label="Primary"
    >
      {/* Wordmark */}
      <div className="flex h-16 shrink-0 items-center gap-2 px-5">
        <span className="h-2.5 w-2.5 rounded-full bg-cobalt" aria-hidden />
        <span className="font-display text-lg font-bold text-ink">Brandscope</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-6">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.heading ?? `group-${gi}`} className="mt-4 first:mt-0">
            {group.heading && (
              <p className="px-3 pb-1.5 pt-2 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                {group.heading}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={[
                        "flex items-center gap-2.5 rounded-chip px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-cobalt/10 font-medium text-cobalt"
                          : "text-ink-secondary hover:bg-base-secondary hover:text-ink",
                      ].join(" ")}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
