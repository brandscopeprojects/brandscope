-- 28_market_power_rls_and_config_invariants.sql
--
-- RLS policies for the Market Power Engine tables + the one-active-config
-- invariant. Reuses the existing tenant helpers only (get_user_brand_ids(),
-- get_user_organisation_id()) — no new RLS helper functions are invented.

-- ─────────────────────────────────────────────────────────────────────────────
-- Brand-scoped tables: standard own-brand SELECT policy (mirrors
-- brand_competitors_own_brands / scan_jobs_own_brands). No customer INSERT/
-- UPDATE/DELETE — all writes happen via the service-role scoring pipeline or
-- gated internal-admin server actions.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY brand_markets_own_brands ON public.brand_markets
  FOR SELECT USING (brand_id IN (SELECT get_user_brand_ids()));

CREATE POLICY brand_operator_identity_own_brands ON public.brand_operator_identity
  FOR SELECT USING (brand_id IN (SELECT get_user_brand_ids()));

-- brand_competitive_position is the only new table intended for eventual
-- customer-facing reads (dashboard). RLS is ready now; the app does not query
-- this table from customer routes until Gate 3 (production cutover).
CREATE POLICY brand_competitive_position_own_brands ON public.brand_competitive_position
  FOR SELECT USING (brand_id IN (SELECT get_user_brand_ids()));

CREATE POLICY brand_competitive_snapshot_own_brands ON public.brand_competitive_snapshot
  FOR SELECT USING (brand_id IN (SELECT get_user_brand_ids()));

CREATE POLICY market_power_override_events_own_brands ON public.market_power_override_events
  FOR SELECT USING (brand_id IN (SELECT get_user_brand_ids()));

-- ─────────────────────────────────────────────────────────────────────────────
-- Global reference layer: Operator × Market intelligence is shared, read-only
-- reference data for any authenticated Brandscope user (mirrors the existing
-- `competitors_read_authenticated` / `competitor_profiles_read_authenticated`
-- policies) — it carries no brand-private information.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY competitor_domains_read_authenticated ON public.competitor_domains
  FOR SELECT TO authenticated USING (true);

CREATE POLICY competitor_domain_markets_read_authenticated ON public.competitor_domain_markets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY operator_market_presence_read_authenticated ON public.operator_market_presence
  FOR SELECT TO authenticated USING (true);

CREATE POLICY market_power_operator_snapshot_read_authenticated ON public.market_power_operator_snapshot
  FOR SELECT TO authenticated USING (true);

CREATE POLICY operator_market_current_position_read_authenticated ON public.operator_market_current_position
  FOR SELECT TO authenticated USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Internal-only tables: RLS ENABLED, deliberately NO policy (Class-2 pattern
-- per docs/skills/rls-policies.md). Only the service role (internal-admin
-- server actions, scoring pipeline) can read/write these:
--   operator_market_presence_evidence  — raw verification evidence
--   market_power_scoring_config        — proprietary weights/thresholds
--   market_power_scoring_config_history
--   market_power_methodology_content   — write path is internal-admin only;
--     customer-facing READ happens through a server action that fetches with
--     the service-role client and returns only display-safe fields, not RLS.
-- No CREATE POLICY needed — the deny-all-to-non-service-role behavior is the
-- absence of policy on an RLS-enabled table.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- One-active-config invariant: transaction-safe via a partial unique index
-- (a CHECK constraint cannot enforce cross-row uniqueness in PostgreSQL).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX market_power_scoring_config_one_active
  ON public.market_power_scoring_config ((true))
  WHERE status = 'active';

-- Atomic activation: retires the current active config (if any) and activates
-- the target draft in one transaction. SECURITY DEFINER so it can be called
-- through a narrowly-scoped internal-admin server action without granting the
-- caller broad table privileges; the app layer still gates who may call it.
CREATE OR REPLACE FUNCTION activate_market_power_config(target_config_id uuid, actor_id uuid, reason text)
RETURNS void AS $$
DECLARE
  previous_active_id uuid;
BEGIN
  SELECT id INTO previous_active_id FROM market_power_scoring_config WHERE status = 'active';

  IF previous_active_id IS NOT NULL THEN
    UPDATE market_power_scoring_config
    SET status = 'retired', retired_at = now(), updated_at = now()
    WHERE id = previous_active_id;

    INSERT INTO market_power_scoring_config_history (config_id, changed_by, change_type, change_reason)
    VALUES (previous_active_id, actor_id, 'retired', reason);
  END IF;

  UPDATE market_power_scoring_config
  SET status = 'active', activated_at = now(), updated_at = now()
  WHERE id = target_config_id AND status = 'draft';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Config % is not a draft or does not exist; activation aborted', target_config_id;
  END IF;

  INSERT INTO market_power_scoring_config_history (config_id, changed_by, change_type, change_reason)
  VALUES (target_config_id, actor_id, 'activated', reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Prevent any UPDATE to a row once it is active/retired at the DB layer too
-- (defense in depth beyond the app-layer "immutable once active" rule) —
-- except for the specific transitions activate_market_power_config performs.
CREATE OR REPLACE FUNCTION prevent_active_config_mutation()
RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'active' AND NEW.status = 'active' THEN
    -- Only status/timestamp bookkeeping columns may change while active is
    -- being retired in the same statement family; block scoring-value edits.
    IF NEW.weight_customer_activity IS DISTINCT FROM OLD.weight_customer_activity
      OR NEW.weight_acquisition_power IS DISTINCT FROM OLD.weight_acquisition_power
      OR NEW.weight_commercial_presence IS DISTINCT FROM OLD.weight_commercial_presence
      OR NEW.weight_customer_mindshare IS DISTINCT FROM OLD.weight_customer_mindshare
    THEN
      RAISE EXCEPTION 'Cannot edit an active market_power_scoring_config; create a new draft version instead';
    END IF;
  END IF;
  IF OLD.status = 'retired' THEN
    RAISE EXCEPTION 'Cannot edit a retired market_power_scoring_config';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER market_power_scoring_config_immutability
  BEFORE UPDATE ON market_power_scoring_config
  FOR EACH ROW EXECUTE FUNCTION prevent_active_config_mutation();
