// TierBadge — competitor tier badge (ui-constraints §12). DOMINANT / CHALLENGER /
// MID-MARKET / NICHE. Per §15, green is NOT used for DOMINANT (green = opportunity
// only); tiers render as neutral ink-weighted pills so colour stays meaningful.
// Presentational. Tokens only.

const LABEL: Record<string, string> = {
  dominant: "DOMINANT",
  challenger: "CHALLENGER",
  mid_market: "MID-MARKET",
  "mid-market": "MID-MARKET",
  niche: "NICHE",
};

export function TierBadge({ tier }: { tier: string | null | undefined }) {
  if (!tier) return null;
  const key = tier.toLowerCase();
  const label = LABEL[key] ?? tier.toUpperCase();
  // Dominant = strongest ink weight; lighter as tier descends.
  const strong = key === "dominant";
  return (
    <span
      className={[
        "inline-flex items-center rounded-chip px-2 py-0.5 font-mono text-[11px] font-medium tracking-wide",
        strong ? "bg-ink text-white" : "bg-base-secondary text-ink-secondary",
      ].join(" ")}
    >
      {label}
    </span>
  );
}
