-- Section 8: RLS helper functions (docs/skills/rls-policies.md)

CREATE OR REPLACE FUNCTION get_user_organisation_id()
RETURNS uuid AS $$
  SELECT organisation_id
  FROM organisation_members
  WHERE profile_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_user_brand_ids()
RETURNS SETOF uuid AS $$
  SELECT b.id
  FROM brands b
  JOIN organisation_members om ON om.organisation_id = b.organisation_id
  WHERE om.profile_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;
