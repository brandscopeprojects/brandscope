// Internal-admin navigation (ui-constraints §11.3, MVP subset). A separate, more
// technical surface than the brand product — brands never see this. Order locked.

import type { LucideIcon } from "lucide-react";
import {
  MessageSquare,
  Activity,
  Bot,
  Plug,
  BookOpen,
  ShieldCheck,
  LineChart,
  SlidersHorizontal,
} from "lucide-react";

export type InternalNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Super-admin-only sections (e.g. Security Centre). */
  superAdminOnly?: boolean;
};

export const INTERNAL_NAV: InternalNavItem[] = [
  { label: "HQ Chat", href: "/brandscope-admin/chat", icon: MessageSquare },
  { label: "HQ Settings", href: "/brandscope-admin/settings", icon: SlidersHorizontal },
  { label: "System Health", href: "/brandscope-admin/health", icon: Activity },
  { label: "Agent Control", href: "/brandscope-admin/agents", icon: Bot },
  { label: "API Management", href: "/brandscope-admin/api-management", icon: Plug },
  { label: "Knowledge Base", href: "/brandscope-admin/knowledge-base", icon: BookOpen },
  { label: "Security Centre", href: "/brandscope-admin/security", icon: ShieldCheck, superAdminOnly: true },
  { label: "Revenue", href: "/brandscope-admin/revenue", icon: LineChart },
];
