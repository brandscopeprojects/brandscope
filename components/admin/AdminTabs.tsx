"use client";

// AdminTabs — brand-admin sub-navigation (ui-constraints §11.4 page-level tabs).
// Sits inside the (app) shell; the active tab is cobalt-underlined. Brand admin is
// part of the brand product, so it keeps the brand visual language.

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Settings", href: "/admin/settings" },
  { label: "Competitors", href: "/admin/competitors" },
  { label: "Alerts", href: "/admin/alerts" },
  { label: "Billing", href: "/admin/billing" },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <div className="border-b border-divider">
      <nav className="-mb-px flex flex-wrap gap-1" aria-label="Admin sections">
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={[
                "border-b-2 px-4 py-2.5 text-sm transition-colors",
                active
                  ? "border-cobalt font-medium text-cobalt"
                  : "border-transparent text-ink-secondary hover:text-ink",
              ].join(" ")}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
