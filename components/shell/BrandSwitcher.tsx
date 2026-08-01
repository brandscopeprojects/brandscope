"use client";

// Header brand switcher — swaps the active brand (cookie via setActiveBrand) and
// re-scopes every screen. Also links to Portfolio Home and the Add-brand wizard.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, Check, Plus, LayoutGrid, Loader2 } from "lucide-react";
import { marketLabel } from "@/lib/format";
import { setActiveBrand } from "@/lib/data/brand-actions";

type Brand = { id: string; name: string; market: string[]; slug: string };

export function BrandSwitcher({ brands, activeBrandId }: { brands: Brand[]; activeBrandId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const active = brands.find((b) => b.id === activeBrandId) ?? brands[0];

  function select(id: string) {
    setOpen(false);
    if (id === activeBrandId) return;
    startTransition(async () => {
      await setActiveBrand(id);
      router.refresh();
    });
  }

  if (!active) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-chip px-2 py-1 hover:bg-base-secondary disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin text-ink-secondary" />
        ) : null}
        <span className="font-display text-sm font-bold text-ink">{active.name}</span>
        {active.market.length > 0 && (
          <span className="hidden text-xs text-ink-secondary sm:inline">
            · {active.market.map(marketLabel).join(", ")}
          </span>
        )}
        <ChevronDown className="h-4 w-4 text-ink-secondary" />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="listbox"
            className="absolute left-0 z-40 mt-2 w-64 overflow-hidden rounded-card border border-divider bg-card shadow-sh2"
          >
            <p className="px-3 pb-1 pt-2 font-mono text-[0.65rem] uppercase tracking-wider text-ink-faint">
              Your brands
            </p>
            <div className="max-h-72 overflow-y-auto pb-1">
              {brands.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  role="option"
                  aria-selected={b.id === active.id}
                  onClick={() => select(b.id)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-base-secondary"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{b.name}</span>
                    {b.market.length > 0 && (
                      <span className="block truncate text-xs text-ink-secondary">
                        {b.market.map(marketLabel).join(", ")}
                      </span>
                    )}
                  </span>
                  {b.id === active.id && <Check className="h-4 w-4 shrink-0 text-cobalt" />}
                </button>
              ))}
            </div>
            <div className="border-t border-divider">
              <Link
                href="/portfolio"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-ink-secondary hover:bg-base-secondary hover:text-ink"
              >
                <LayoutGrid className="h-4 w-4" /> All brands
              </Link>
              <Link
                href="/onboarding"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-cobalt hover:bg-base-secondary"
              >
                <Plus className="h-4 w-4" /> Add brand
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
