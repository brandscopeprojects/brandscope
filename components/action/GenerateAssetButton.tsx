"use client";

// GenerateAssetButton — primary cobalt CTA on the action card footer (ui-constraints §7).
// Full-width "✦ Generate asset". Cobalt = primary action (§2.2).
// The /api/assets/generate route lands in a later sprint — this just calls `onGenerate`.
// Shows a local pending state while an async `onGenerate` resolves.

import { useState } from "react";

export function GenerateAssetButton({
  recommendationId,
  onGenerate,
}: {
  recommendationId: string;
  onGenerate?: () => void | Promise<void>;
}) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!onGenerate || pending) return;
    try {
      setPending(true);
      await onGenerate();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      data-recommendation-id={recommendationId}
      onClick={handleClick}
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-1.5 rounded-chip bg-cobalt px-4 py-2 text-sm font-medium text-white shadow-sh1 transition-colors hover:bg-cobalt/90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span aria-hidden="true">✦</span>
      <span>{pending ? "Generating…" : "Generate asset"}</span>
    </button>
  );
}
