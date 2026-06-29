import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBrand } from "@/lib/data/brand";
import type { Database } from "@/types/database.types";
import {
  ALERT_TRIGGERS,
  type AlertTrigger,
} from "@/app/(app)/admin/alerts/constants";

// Brand-admin Alerts data layer (Screen 22). Both alert_configs and alert_history
// are Class-1 brand-scoped tables (RLS *_own_brands), so we read them through the
// USER-SESSION client and let RLS scope the rows — never the service role.

export type AlertConfigRow = Database["public"]["Tables"]["alert_configs"]["Row"];
export type AlertHistoryRow = Database["public"]["Tables"]["alert_history"]["Row"];

// A single trigger surfaced from the one alert_configs row (see constants.ts shape
// note). `configId` is the id of that shared row — every write targets it.
export type AlertTriggerView = {
  trigger: AlertTrigger;
  enabled: boolean;
  /** Current threshold value (null when this trigger has no threshold column). */
  threshold: number | null;
};

export type AlertConfigView = {
  /** The single alert_configs row id, or null when the brand has no config yet. */
  configId: string | null;
  emailEnabled: boolean;
  emailAddress: string | null;
  triggers: AlertTriggerView[];
};

export type AlertHistoryView = {
  id: string;
  alertType: string;
  /** Human label for the alert_type, falling back to the raw type. */
  alertLabel: string;
  message: string;
  /** ISO timestamp the alert fired (created_at). */
  firedAt: string | null;
  /** "fired" | "resolved" | etc. — raw status string from the row. */
  status: string | null;
  /** Channels the alert was actually delivered through (e.g. ["email","in_app"]). */
  deliveredVia: string[];
};

// alert_type → catalogue label lookup. The agent that writes alert_history is a
// Sprint-3 target; its `alert_type` strings are expected to match the trigger
// enabledColumn stem (e.g. "bonus_change"). We map defensively and fall back to
// the raw type so an unknown/new type still renders.
const ALERT_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  ALERT_TRIGGERS.map((t) => [
    t.enabledColumn.replace(/_enabled$/, ""),
    t.label,
  ]),
);

function labelForAlertType(alertType: string): string {
  return (
    ALERT_TYPE_LABEL[alertType] ??
    ALERT_TYPE_LABEL[alertType.replace(/_enabled$/, "")] ??
    alertType
  );
}

/**
 * The brand's alert configuration as a flat list of trigger view-models.
 *
 * alert_configs is ONE ROW PER BRAND; we read that single row and project it onto
 * the trigger catalogue. When the brand has never configured alerts the row is
 * absent → configId is null, every trigger reads disabled, and the page shows the
 * "Set up alerts" prompt (which calls seedDefaultAlertConfigs).
 *
 * Wrapped in React cache() so repeated calls in one request share the query.
 */
export const getAlertConfigs = cache(
  async function getAlertConfigs(): Promise<AlertConfigView> {
    const empty: AlertConfigView = {
      configId: null,
      emailEnabled: false,
      emailAddress: null,
      triggers: ALERT_TRIGGERS.map((trigger) => ({
        trigger,
        enabled: false,
        threshold: trigger.thresholdColumn ? null : null,
      })),
    };

    const current = await getCurrentBrand();
    if (!current) return empty;

    const supabase = createClient();
    const { data } = await supabase
      .from("alert_configs")
      .select("*")
      .eq("brand_id", current.id)
      .maybeSingle();

    if (!data) return empty;

    return {
      configId: data.id,
      emailEnabled: data.email_enabled ?? false,
      emailAddress: data.email_address ?? null,
      triggers: ALERT_TRIGGERS.map((trigger) => ({
        trigger,
        enabled: (data[trigger.enabledColumn] as boolean | null) ?? false,
        threshold: trigger.thresholdColumn
          ? ((data[trigger.thresholdColumn] as number | null) ?? null)
          : null,
      })),
    };
  },
);

/**
 * Recent alert_history rows for the brand, latest first (limit 30).
 *
 * `payload` is jsonb whose shape is owned by the between-cycle alert agent
 * (Sprint-3 write target). We do NOT depend on its internal shape here — the row's
 * own `message`/`alert_type`/`delivered_via` columns are sufficient to render the
 * history table, so payload is intentionally left unread. Returns [] when none.
 */
export const getAlertHistory = cache(
  async function getAlertHistory(): Promise<AlertHistoryView[]> {
    const current = await getCurrentBrand();
    if (!current) return [];

    const supabase = createClient();
    const { data } = await supabase
      .from("alert_history")
      .select("id, alert_type, message, created_at, status, delivered_via")
      .eq("brand_id", current.id)
      .order("created_at", { ascending: false })
      .limit(30);

    if (!data) return [];

    return data.map((row) => ({
      id: row.id,
      alertType: row.alert_type,
      alertLabel: labelForAlertType(row.alert_type),
      message: row.message,
      firedAt: row.created_at,
      status: row.status,
      deliveredVia: Array.isArray(row.delivered_via)
        ? row.delivered_via.filter((v): v is string => typeof v === "string")
        : [],
    }));
  },
);
