-- Step 3.2: transactional org + membership + brand provisioning primitive.
-- Called server-side via the service-role client during onboarding. SECURITY DEFINER
-- so the whole thing is one transaction; slugs auto-generated + uniquified with a 6-char suffix.
-- The brands INSERT fires handle_new_brand() which seeds brand_preferences + alert_configs.
CREATE OR REPLACE FUNCTION public.provision_brand(
  p_user_id uuid,
  p_org_name text,
  p_brand_name text,
  p_domain text,
  p_markets text[],
  p_industry text DEFAULT 'igaming',
  p_tier text DEFAULT 'challenger'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_brand_id uuid;
  v_org_base text;
  v_brand_base text;
  v_suffix text;
BEGIN
  v_org_base := trim(both '-' from coalesce(nullif(regexp_replace(lower(trim(p_org_name)), '[^a-z0-9]+', '-', 'g'), ''), 'org'));
  v_brand_base := trim(both '-' from coalesce(nullif(regexp_replace(lower(trim(p_brand_name)), '[^a-z0-9]+', '-', 'g'), ''), 'brand'));
  v_suffix := substr(gen_random_uuid()::text, 1, 6);

  INSERT INTO organisations (name, slug)
    VALUES (p_org_name, v_org_base || '-' || v_suffix)
    RETURNING id INTO v_org_id;

  INSERT INTO organisation_members (organisation_id, profile_id, role, accepted_at)
    VALUES (v_org_id, p_user_id, 'brand_admin', now());

  INSERT INTO brands (organisation_id, name, domain, slug, market, industry, tier)
    VALUES (v_org_id, p_brand_name, p_domain, v_brand_base || '-' || v_suffix, p_markets, p_industry, p_tier)
    RETURNING id INTO v_brand_id;  -- trigger seeds brand_preferences + alert_configs

  RETURN v_brand_id;
END;
$$;

-- Only the service role may call it (server-side onboarding); never anon/authenticated.
REVOKE EXECUTE ON FUNCTION public.provision_brand(uuid, text, text, text, text[], text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.provision_brand(uuid, text, text, text, text[], text, text) TO service_role;
