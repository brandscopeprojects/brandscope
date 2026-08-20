"use client";

// Methodology / tooltip content editor — Competitive Intelligence back-office.
// Edits customer-facing explanation copy only (market_power_methodology_content).
// Proprietary weights/thresholds are never part of this content and are edited
// in ScoringConfigPanel, an internal-admin-only surface.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMethodologyContent } from "@/app/brandscope-admin/competitive-intelligence/actions";
import type { MethodologyContentRow } from "@/lib/data/internal-competitive-intelligence";

const inputClass =
  "w-full rounded-chip border border-divider bg-card px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-cobalt";

export function MethodologyContentEditor({
  content,
  actorProfileId,
}: {
  content: MethodologyContentRow[];
  actorProfileId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const bySection = content.reduce<Record<string, MethodologyContentRow[]>>((acc, row) => {
    const section = row.drawerSection ?? "other";
    (acc[section] ??= []).push(row);
    return acc;
  }, {});

  function startEdit(row: MethodologyContentRow) {
    setEditingId(row.id);
    setTitle(row.title);
    setBody(row.body);
    setError(null);
  }

  function submit(contentId: string) {
    setError(null);
    startTransition(async () => {
      const result = await updateMethodologyContent({ contentId, title, body, actorProfileId });
      if (!result.ok) setError(result.error);
      else {
        setEditingId(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-chip border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {Object.entries(bySection).map(([section, rows]) => (
        <div key={section} className="space-y-3">
          <h3 className="font-display text-sm font-bold capitalize text-ink">{section}</h3>
          {rows.map((row) => (
            <div key={row.id} className="rounded-card border border-divider bg-card p-4">
              {editingId === row.id ? (
                <div className="space-y-3">
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-ink-secondary">Title</span>
                    <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-ink-secondary">Body</span>
                    <textarea
                      className={`${inputClass} min-h-24`}
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => submit(row.id)}
                      className="rounded-chip bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-chip border border-divider px-4 py-2 text-sm font-medium text-ink"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-ink">{row.title}</p>
                    <p className="mt-1 text-sm text-ink-secondary">{row.body}</p>
                    <p className="mt-1 font-mono text-xs text-ink-faint">{row.contentKey}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startEdit(row)}
                    className="shrink-0 rounded-chip border border-divider px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-hover"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
