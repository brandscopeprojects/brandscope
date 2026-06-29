// AssetsTypeBadge — neutral category chip for an asset's type (Screen 16).
// Category-style styling (neutral grey, ui-constraints §8.1) — asset type is a
// classification, not a status, so it never borrows a status colour. Maps the raw
// `asset_type` string to a human label and falls back to a title-cased version of
// any unknown type so a new write-target type still renders honestly.
// Tokens only.

const LABELS: Record<string, string> = {
  campaign_brief: "Campaign Brief",
  social_post: "Social Post",
  ad_copy: "Ad Copy",
  email: "Email",
  landing_page: "Landing Page",
  blog_post: "Blog Post",
  press_release: "Press Release",
  promo_message: "Promo Message",
};

export function assetTypeLabel(assetType: string): string {
  if (LABELS[assetType]) return LABELS[assetType];
  // Title-case an unknown snake/kebab type so it never renders as a raw slug.
  return assetType
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AssetsTypeBadge({ assetType }: { assetType: string }) {
  return (
    <span className="inline-flex items-center rounded-chip bg-base-secondary px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-ink-secondary">
      {assetTypeLabel(assetType)}
    </span>
  );
}
