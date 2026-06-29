// Canonical brand-facing navigation (ui-constraints §11.2, MVP subset).
// Order and labels are locked here so the sidebar, mobile bottom-nav and any
// breadcrumb stay in sync. Product Intelligence is intentionally absent (merged
// into Competitor Profile per mvp-constraints §2).

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Globe2,
  Megaphone,
  TrendingUp,
  Share2,
  Layers,
  Users,
  Scale,
  Briefcase,
  Sparkles,
  ListChecks,
  Images,
  Gauge,
  FileText,
  MessageSquare,
  Settings,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type NavGroup = {
  heading: string | null;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    heading: null,
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    heading: "Intelligence",
    items: [
      { label: "Market Intel", href: "/market-intel", icon: Globe2 },
      { label: "Promotion Signals", href: "/promotions", icon: Megaphone },
      { label: "Traffic & SEO", href: "/traffic-seo", icon: TrendingUp },
      { label: "Social & Ads", href: "/social-ads", icon: Share2 },
      { label: "Tech Stack", href: "/tech-stack", icon: Layers },
      { label: "Customers", href: "/customers", icon: Users },
      { label: "Regulatory", href: "/regulatory", icon: Scale },
      { label: "Hiring & Signals", href: "/hiring-signals", icon: Briefcase },
      { label: "GEO / AEO / SEO", href: "/geo-aeo-seo", icon: Sparkles },
    ],
  },
  {
    heading: "Act",
    items: [
      { label: "Action Plan", href: "/action-plan", icon: ListChecks },
      { label: "Assets", href: "/assets", icon: Images },
      { label: "Performance", href: "/performance", icon: Gauge },
      { label: "Reports", href: "/reports", icon: FileText },
      { label: "Brand Chat", href: "/chat", icon: MessageSquare },
    ],
  },
  {
    heading: null,
    items: [{ label: "Settings", href: "/admin/settings", icon: Settings }],
  },
];
