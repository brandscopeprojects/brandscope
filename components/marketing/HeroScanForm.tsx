"use client";

// Homepage hero form — the fewest-clicks path in: type a domain, press one
// button, arrive in onboarding with the domain already filled (via /login?next=).

import { useState } from "react";
import { useRouter } from "next/navigation";

export function HeroScanForm() {
  const router = useRouter();
  const [domain, setDomain] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = domain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const next = clean ? `/onboarding?domain=${encodeURIComponent(clean)}` : "/onboarding";
    router.push(`/login?next=${encodeURIComponent(next)}`);
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto flex w-full max-w-xl flex-col gap-2 rounded-card bg-card p-2 shadow-sh2 sm:flex-row"
    >
      <input
        type="text"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        value={domain}
        onChange={(e) => setDomain(e.target.value)}
        placeholder="yourbrand.com"
        aria-label="Your brand's domain"
        className="min-w-0 flex-1 rounded-chip bg-transparent px-4 py-3 font-mono text-sm text-ink placeholder:text-ink-faint focus:outline-none"
      />
      <button
        type="submit"
        className="whitespace-nowrap rounded-chip bg-cobalt px-6 py-3 text-sm font-semibold text-white shadow-sh1 transition-shadow hover:shadow-sh2"
      >
        Scan my market
      </button>
    </form>
  );
}
