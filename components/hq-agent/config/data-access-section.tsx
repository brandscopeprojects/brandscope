"use client";

// §13-E Data access — a toggle per tool category (the model only sees enabled
// categories) plus source + freshness disclosure toggles.

import { Section, Toggle } from "./fields";
import type { HqDataConfig, ToolCategoryMeta } from "./types";

export function DataAccessSection({
  value,
  onChange,
  toolCategories,
}: {
  value: HqDataConfig;
  onChange: (patch: Partial<HqDataConfig>) => void;
  toolCategories: ToolCategoryMeta[];
}) {
  function toggleCategory(key: string, on: boolean) {
    onChange({ categories: { ...value.categories, [key]: on } });
  }

  return (
    <Section
      title="Data access"
      description="Which categories of Brandscope data the assistant may query, and how it discloses them."
    >
      <div>
        <p className="mb-2 text-sm font-medium text-ink-secondary">Categories</p>
        <div className="divide-y divide-divider">
          {toolCategories.map((cat) => (
            <Toggle
              key={cat.key}
              label={cat.label}
              checked={value.categories?.[cat.key] ?? false}
              onChange={(v) => toggleCategory(cat.key, v)}
            />
          ))}
          {toolCategories.length === 0 && (
            <p className="py-2 text-sm text-ink-faint">No categories available.</p>
          )}
        </div>
      </div>

      <div className="divide-y divide-divider border-t border-divider pt-1">
        <Toggle
          label="Show sources"
          description="Attach a source/citation card to answers backed by data."
          checked={value.showSources}
          onChange={(v) => onChange({ showSources: v })}
        />
        <Toggle
          label="Show data freshness"
          description="Display how recently the underlying data was updated."
          checked={value.showFreshness}
          onChange={(v) => onChange({ showFreshness: v })}
        />
      </div>
    </Section>
  );
}
