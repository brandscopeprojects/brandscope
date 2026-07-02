"use client";

// Display-only wrapper around the real ActionCard for the marketing homepage.
// Renders the exact production component with inert handlers so the showcase
// can never fire authed server actions from a public page.

import type { Recommendation } from "@/types/view-models";
import { ActionCard } from "@/components/action/ActionCard";

const noop = () => {};

export function ShowcaseActionCard({ rec }: { rec: Recommendation }) {
  return (
    <ActionCard
      recommendation={rec}
      onAccept={noop}
      onSnooze={noop}
      onDismiss={noop}
      onGenerateAsset={noop}
    />
  );
}
