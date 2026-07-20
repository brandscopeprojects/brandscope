"use client";

// Memory — owner-curated facts / preferences / lessons injected into the system
// prompt. Self-contained: reads and writes /api/hq-agent/memory. The agent never
// writes here.

import { useEffect, useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { Section, Field, inputClass } from "./fields";

type MemoryKind = "fact" | "preference" | "lesson";
type MemoryEntry = {
  id: string;
  kind: MemoryKind;
  content: string;
  created_at: string;
};

const KINDS: { value: MemoryKind; label: string }[] = [
  { value: "fact", label: "Fact" },
  { value: "preference", label: "Preference" },
  { value: "lesson", label: "Lesson" },
];

const kindClass: Record<MemoryKind, string> = {
  fact: "bg-info/10 text-info",
  preference: "bg-opportunity/10 text-opportunity",
  lesson: "bg-watch/10 text-watch",
};

export function MemorySection() {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<MemoryKind>("fact");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/hq-agent/memory");
        const data = await res.json();
        if (alive && data.ok) setEntries(data.memory ?? []);
      } catch {
        if (alive) setError("Could not load memory.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function add() {
    const trimmed = content.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/hq-agent/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, content: trimmed }),
      });
      const data = await res.json();
      if (data.ok && data.entry) {
        setEntries((prev) => [data.entry, ...prev]);
        setContent("");
      } else {
        setError(data.error ?? "Could not add entry.");
      }
    } catch {
      setError("Could not add entry.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const prev = entries;
    setEntries((e) => e.filter((x) => x.id !== id));
    try {
      const res = await fetch("/api/hq-agent/memory", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!data.ok) setEntries(prev);
    } catch {
      setEntries(prev);
    }
  }

  return (
    <Section
      title="Memory"
      description="Durable facts, preferences and lessons injected into every conversation. Curated by you — the assistant never edits this."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[8rem_1fr]">
        <Field label="Kind" htmlFor="hq-memory-kind">
          <select
            id="hq-memory-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as MemoryKind)}
            className={inputClass}
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Content" htmlFor="hq-memory-content">
          <textarea
            id="hq-memory-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="e.g. Our fiscal year starts in April."
            className={`${inputClass} resize-y`}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={add}
          disabled={busy || !content.trim()}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-chip bg-cobalt px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {busy ? "Adding…" : "Add memory"}
        </button>
        {error && (
          <p className="text-sm font-medium text-urgent" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="border-t border-divider pt-4">
        {loading ? (
          <p className="text-sm text-ink-faint">Loading memory…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-ink-faint">No memory entries yet.</p>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-start justify-between gap-3 rounded-chip border border-divider bg-base-secondary/50 p-3"
              >
                <div className="min-w-0 space-y-1">
                  <span
                    className={`inline-block rounded-chip px-2 py-0.5 text-[11px] font-semibold capitalize ${kindClass[entry.kind]}`}
                  >
                    {entry.kind}
                  </span>
                  <p className="break-words text-sm text-ink">{entry.content}</p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(entry.id)}
                  aria-label="Delete memory entry"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-chip text-ink-faint transition-colors hover:bg-urgent/10 hover:text-urgent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}
