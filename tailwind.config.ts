import type { Config } from "tailwindcss";

// Tokens are the single source of truth from ui-constraints.md.
// Do not hardcode hex/fonts in components — use these tokens.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // surfaces & text (ui-constraints §2.1)
        base: "#F5F3EE",          // app canvas (warm off-white)
        "base-secondary": "#EDEAE2",
        card: "#FFFFFF",
        ink: "#141416",           // primary text (near-black)
        "ink-secondary": "#6B6B78",
        "ink-faint": "#9999A8",
        divider: "#E8E6E0",
        // single brand accent (ui-constraints §2.2) — own brand / primary CTA / links ONLY
        cobalt: "#2B5CE6",
        // status colours (ui-constraints §2.3)
        urgent: "#E84545",
        watch: "#E8952A",
        opportunity: "#27A96C",
        info: "#2B5CE6",
      },
      fontFamily: {
        // ui-constraints §3
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],   // all UI text
        display: ["var(--font-syne)", "system-ui", "sans-serif"], // big numbers / headline metrics / wordmark
        mono: ["var(--font-jetbrains-mono)", "monospace"],        // timestamps / URLs / data values / scores
      },
      boxShadow: {
        // ui-constraints §4.1 — subtle elevation
        sh1: "0 1px 3px rgba(20,20,22,0.06), 0 1px 2px rgba(20,20,22,0.04)",
        sh2: "0 4px 16px rgba(20,20,22,0.08), 0 2px 6px rgba(20,20,22,0.04)",
        sh3: "0 12px 40px rgba(20,20,22,0.10), 0 4px 12px rgba(20,20,22,0.05)",
      },
      borderRadius: {
        // ui-constraints §4.2
        card: "10px",  // 8–12px cards
        chip: "7px",   // 6–8px chips/tags
      },
    },
  },
  plugins: [],
};

export default config;
