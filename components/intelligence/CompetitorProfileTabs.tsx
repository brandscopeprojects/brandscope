"use client";

// CompetitorProfileTabs — the page-level tab switcher for the Competitor Profile
// (Screen 5, ui-constraints §11.4): Overview · Promotions · Digital ·
// Intelligence. Client component: holds the active-tab state and swaps the
// visible section client-side. Sections are passed in already-rendered (the page
// is a server component that builds each section body from real data) — this
// component never fetches and never touches the competitor's own metrics, so it
// stays free of cobalt (cobalt = the user's own brand only; the active tab uses
// ink, not cobalt). Tokens only.

import { useState } from "react";
import type { ReactNode } from "react";

export type CompetitorTabKey =
  | "overview"
  | "promotions"
  | "digital"
  | "intelligence";

type Tab = { key: CompetitorTabKey; label: string };

const TABS: Tab[] = [
  { key: "overview", label: "Overview" },
  { key: "promotions", label: "Promotions" },
  { key: "digital", label: "Digital" },
  { key: "intelligence", label: "Intelligence" },
];

export function CompetitorProfileTabs({
  sections,
  initial = "overview",
}: {
  /** Each tab's already-rendered body. */
  sections: Record<CompetitorTabKey, ReactNode>;
  initial?: CompetitorTabKey;
}) {
  const [active, setActive] = useState<CompetitorTabKey>(initial);

  return (
    <div className="space-y-5">
      {/* Tab bar — wraps on mobile. Active tab = ink underline (not cobalt). */}
      <div
        role="tablist"
        aria-label="Competitor profile sections"
        className="flex flex-wrap gap-1 border-b border-divider"
      >
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-controls={`competitor-tabpanel-${tab.key}`}
              id={`competitor-tab-${tab.key}`}
              onClick={() => setActive(tab.key)}
              className={[
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-ink text-ink"
                  : "border-transparent text-ink-secondary hover:text-ink",
              ].join(" ")}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`competitor-tabpanel-${active}`}
        aria-labelledby={`competitor-tab-${active}`}
      >
        {sections[active]}
      </div>
    </div>
  );
}
