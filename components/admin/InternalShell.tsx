"use client";

// InternalShell — the internal-admin frame (ui-constraints §11.3). Deliberately a
// DIFFERENT visual language from the brand product: a dark ink sidebar signals
// "you are in the internal environment, not a brand workspace." Borrows the same
// tokens; cobalt still marks the active item. Owns the mobile drawer state.

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { INTERNAL_NAV } from "@/components/admin/internal-nav-items";

export function InternalShell({
  operatorEmail,
  isSuperAdmin,
  children,
}: {
  operatorEmail: string;
  isSuperAdmin: boolean;
  children: React.ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();
  const items = INTERNAL_NAV.filter((i) => !i.superAdminOnly || isSuperAdmin);

  return (
    <div className="min-h-screen bg-base">
      <nav
        className={[
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-ink text-white",
          "transition-transform lg:translate-x-0",
          navOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
        aria-label="Internal admin"
      >
        <div className="flex h-16 shrink-0 items-center gap-2 px-5">
          <span className="h-2.5 w-2.5 rounded-full bg-cobalt" aria-hidden />
          <span className="font-display text-base font-bold">Brandscope</span>
          <span className="rounded-chip bg-white/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-white/70">
            Internal
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-6">
          <ul className="space-y-0.5">
            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setNavOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "flex items-center gap-2.5 rounded-chip px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-cobalt font-medium text-white"
                        : "text-white/70 hover:bg-white/10 hover:text-white",
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
      </nav>

      {navOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-30 bg-ink/40 lg:hidden"
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
            <span className="font-mono text-xs text-ink-secondary">
              Internal Operations Console
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-xs text-ink-faint sm:inline">
              {operatorEmail}
            </span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-chip px-3 py-1.5 text-sm text-ink-secondary transition-colors hover:text-ink"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] px-4 py-6 md:px-6 md:py-8">{children}</div>
      </div>
    </div>
  );
}
