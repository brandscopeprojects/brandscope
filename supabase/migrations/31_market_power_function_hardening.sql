-- 31_market_power_function_hardening.sql
--
-- Fixes two advisor findings surfaced immediately after migration 28:
--
-- (1) anon_security_definer_function_executable / authenticated_...: because
--     activate_market_power_config() is SECURITY DEFINER, PostgREST exposes it
--     at /rest/v1/rpc/activate_market_power_config by default, callable by any
--     signed-in user (and anon). It must only ever be invoked by the
--     service-role client from a requireInternalAdmin()-gated server action
--     (app-layer authorization) — never directly by an end user's JWT. Revoke
--     EXECUTE from PUBLIC/anon/authenticated; the service role bypasses grants.
--
-- (2) function_search_path_mutable: prevent_active_config_mutation() (the
--     immutability trigger) was created without a pinned search_path, unlike
--     the existing get_user_brand_ids()/get_user_organisation_id() helpers.
--     Recreate it with SET search_path = public.

REVOKE EXECUTE ON FUNCTION activate_market_power_config(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION prevent_active_config_mutation()
RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'active' AND NEW.status = 'active' THEN
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
$$ LANGUAGE plpgsql SET search_path = public;
