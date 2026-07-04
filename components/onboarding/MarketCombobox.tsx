"use client";

// MarketCombobox — GLOBAL market multi-select (component-library.md, owner-approved
// 2026-07). Search-first: selected markets render as removable flag tokens
// (setup-agent detections badged ✦), a combobox input filters the full country
// list, and the browse panel groups by region with sticky headers. On mobile the
// panel presents as a bottom sheet. Markets without regulatory corpus coverage
// show an honest "Limited regulatory coverage" hint at selection time.
//
// Accessibility: ARIA combobox pattern — role=combobox input, aria-expanded,
// aria-activedescendant onto role=option rows; ArrowUp/Down navigate the flat
// filtered list, Enter toggles, Escape closes, Backspace on an empty query
// removes the last token. Motion is gated behind useReducedMotion.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  COUNTRIES,
  COUNTRY_BY_VALUE,
  REGION_ORDER,
  type Country,
} from "@/lib/onboarding/countries";

type MarketComboboxProps = {
  selected: string[];
  /** Markets the setup agent detected (badged ✦; pre-selected by the caller). */
  suggested?: string[];
  onToggle: (value: string) => void;
  placeholder?: string;
};

/** Case- and diacritic-insensitive needle match. */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

const springFast = { type: "spring" as const, stiffness: 520, damping: 34 };

export function MarketCombobox({
  selected,
  suggested = [],
  onToggle,
  placeholder = "Search any country…",
}: MarketComboboxProps) {
  const reduced = useReducedMotion();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  // First-mount flag: detected tokens stagger in once, then behave normally.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);

  const suggestedSet = useMemo(() => new Set(suggested), [suggested]);

  // Flat filtered list (keyboard order) + region grouping (render order).
  const filtered = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return COUNTRIES as readonly Country[];
    return COUNTRIES.filter(
      (c) => norm(c.label).includes(q) || norm(c.region).includes(q),
    );
  }, [query]);

  const grouped = useMemo(() => {
    const byRegion = new Map<string, Country[]>();
    for (const c of filtered) {
      const arr = byRegion.get(c.region);
      if (arr) arr.push(c);
      else byRegion.set(c.region, [c]);
    }
    return REGION_ORDER.filter((r) => byRegion.has(r)).map((r) => ({
      region: r,
      countries: byRegion.get(r)!,
    }));
  }, [filtered]);

  // Keep the active option in view + valid.
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  function toggle(value: string) {
    onToggle(value);
    setQuery("");
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (open && filtered[activeIndex]) {
        e.preventDefault();
        toggle(filtered[activeIndex].value);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && query === "" && selected.length > 0) {
      onToggle(selected[selected.length - 1]);
    }
  }

  const tokenTransition = reduced ? { duration: 0 } : springFast;

  return (
    <div ref={rootRef} className="relative flex flex-col gap-2.5">
      {/* ── Selected tokens ── */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-live="polite">
          <AnimatePresence mode="popLayout" initial={false}>
            {selected.map((value, i) => {
              const c = COUNTRY_BY_VALUE.get(value);
              if (!c) return null;
              const isSuggested = suggestedSet.has(value);
              return (
                <motion.span
                  key={value}
                  layout
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    transition: mounted.current
                      ? tokenTransition
                      : { ...tokenTransition, delay: reduced ? 0 : i * 0.04 },
                  }}
                  exit={{ opacity: 0, scale: 0.92, transition: { duration: reduced ? 0 : 0.12 } }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-cobalt px-3 py-1.5 text-sm text-white"
                >
                  <span aria-hidden>{c.flag}</span>
                  {c.label}
                  {isSuggested && (
                    <span aria-label="detected from your site" title="Detected from your site">
                      ✦
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onToggle(value)}
                    aria-label={`Remove ${c.label}`}
                    className="ml-0.5 rounded-full px-1 leading-none text-white/80 transition-colors hover:bg-white/15 hover:text-white"
                  >
                    ×
                  </button>
                </motion.span>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ── Search input (combobox) ── */}
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={
          open && filtered[activeIndex] ? `${listboxId}-${filtered[activeIndex].value}` : undefined
        }
        aria-autocomplete="list"
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="w-full rounded-chip border border-divider bg-card px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-cobalt"
      />
      <p className="text-xs text-ink-faint" aria-live="polite">
        {selected.length === 0
          ? "Every country is available — start typing or browse the list."
          : `${selected.length} market${selected.length === 1 ? "" : "s"} selected`}
      </p>

      {/* ── Panel: dropdown on md+, bottom sheet on mobile ── */}
      <AnimatePresence>
        {open && (
          <>
            {/* Mobile backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.15 }}
              className="fixed inset-0 z-40 bg-ink/30 md:hidden"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <motion.div
              key="panel"
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
              transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 36 }}
              className={[
                // mobile: bottom sheet
                "fixed inset-x-0 bottom-0 z-50 max-h-[75vh] rounded-t-2xl",
                // desktop: anchored dropdown
                "md:absolute md:inset-x-0 md:bottom-auto md:top-full md:z-30 md:mt-2 md:max-h-[340px] md:rounded-card",
                "flex flex-col overflow-hidden border border-divider bg-card shadow-sh1",
              ].join(" ")}
            >
              <div className="flex items-center justify-between border-b border-divider px-4 py-2.5 md:hidden">
                <span className="text-sm font-medium text-ink">Select markets</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-chip bg-base-secondary px-3 py-1 text-sm text-ink-secondary"
                >
                  Done
                </button>
              </div>

              <div
                ref={listRef}
                id={listboxId}
                role="listbox"
                aria-multiselectable
                aria-label="Markets"
                className="overflow-y-auto overscroll-contain p-1.5 [scrollbar-gutter:stable]"
              >
                {grouped.length === 0 && (
                  <p className="px-3 py-6 text-center text-sm text-ink-faint">
                    No markets match &ldquo;{query}&rdquo;
                  </p>
                )}
                {grouped.map(({ region, countries }) => (
                  <div key={region} style={{ contentVisibility: "auto" }}>
                    <p className="sticky top-0 z-10 bg-card/95 px-3 pb-1 pt-2.5 text-xs font-medium uppercase tracking-wide text-ink-faint backdrop-blur-sm">
                      {region}
                    </p>
                    {countries.map((c) => {
                      const flatIndex = filtered.indexOf(c);
                      const isSelected = selected.includes(c.value);
                      const isActive = flatIndex === activeIndex;
                      return (
                        <div
                          key={c.value}
                          id={`${listboxId}-${c.value}`}
                          role="option"
                          aria-selected={isSelected}
                          data-index={flatIndex}
                          onPointerDown={(e) => {
                            e.preventDefault(); // keep input focus
                            toggle(c.value);
                          }}
                          onPointerMove={() => setActiveIndex(flatIndex)}
                          className={[
                            "flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-chip px-3 py-2 text-sm",
                            isActive ? "bg-base-secondary" : "",
                            isSelected ? "text-ink" : "text-ink-secondary",
                          ].join(" ")}
                        >
                          <span aria-hidden>{c.flag}</span>
                          <span className="min-w-0 flex-1 truncate">
                            {c.label}
                            {suggestedSet.has(c.value) && (
                              <span className="ml-1.5 text-cobalt" aria-hidden>✦</span>
                            )}
                            {!c.regulatoryCovered && (
                              <span className="ml-2 text-xs text-ink-faint">
                                Limited regulatory coverage
                              </span>
                            )}
                          </span>
                          <span
                            className={[
                              "text-cobalt transition-opacity",
                              isSelected ? "opacity-100" : "opacity-0",
                            ].join(" ")}
                            aria-hidden
                          >
                            ✓
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
