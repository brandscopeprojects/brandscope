-- Section 2: Base tables (auth/org, brands, competitors)
-- Includes amendment §B columns on competitor_changes (processed, processed_at).

CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'brand_admin'
    CHECK (role IN ('super_admin','internal_admin','brand_admin','brand_editor','brand_viewer')),
  avatar_url text,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  plan text NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free','growth','professional','enterprise')),
  plan_started_at timestamptz,
  plan_renews_at timestamptz,
  mrr_kobo bigint DEFAULT 0,
  is_active boolean DEFAULT true,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE organisation_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'brand_viewer'
    CHECK (role IN ('brand_admin','brand_editor','brand_viewer')),
  invited_by uuid REFERENCES profiles(id),
  invited_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organisation_id, profile_id)
);

CREATE TABLE brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  domain text NOT NULL,
  slug text UNIQUE NOT NULL,
  market text[] NOT NULL DEFAULT '{}',
  industry text NOT NULL DEFAULT 'igaming'
    CHECK (industry IN ('igaming','fintech','fmcg','telecom','ecommerce')),
  tier text DEFAULT 'challenger'
    CHECK (tier IN ('dominant','challenger','mid_market','niche')),
  positioning_statement text,
  primary_colour text DEFAULT '#2B5CE6',
  logo_url text,
  scan_frequency text DEFAULT 'weekly'
    CHECK (scan_frequency IN ('weekly','daily','manual')),
  is_active boolean DEFAULT true,
  onboarding_completed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE brand_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE UNIQUE,
  promotions_enabled boolean DEFAULT true,
  traffic_seo_enabled boolean DEFAULT true,
  social_ads_enabled boolean DEFAULT true,
  geo_aeo_enabled boolean DEFAULT true,
  regulatory_enabled boolean DEFAULT true,
  product_intel_enabled boolean DEFAULT true,
  customer_intel_enabled boolean DEFAULT true,
  hiring_signals_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE competitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL UNIQUE,
  name text NOT NULL,
  tier text DEFAULT 'challenger'
    CHECK (tier IN ('dominant','challenger','mid_market','niche')),
  industry text DEFAULT 'igaming',
  primary_market text,
  logo_url text,
  first_seen_at timestamptz DEFAULT now(),
  last_scanned_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE competitor_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id uuid NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  scan_week date NOT NULL,
  threat_score numeric(5,2),
  estimated_monthly_traffic bigint,
  organic_traffic_pct numeric(5,2),
  paid_traffic_pct numeric(5,2),
  domain_authority numeric(5,2),
  social_followers_total bigint,
  active_ads_count integer,
  tech_stack_count integer,
  reach_score numeric(5,2),
  aggression_score numeric(5,2),
  sov_pct numeric(5,2),
  raw_data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(competitor_id, scan_week)
);

CREATE TABLE competitor_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id uuid NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  detected_at timestamptz NOT NULL DEFAULT now(),
  change_type text NOT NULL
    CHECK (change_type IN ('promotion','ad_change','tech_stack','hiring','product','seo','regulatory','pricing')),
  impact_level text DEFAULT 'medium'
    CHECK (impact_level IN ('high','medium','low')),
  summary text NOT NULL,
  detail jsonb,
  source_url text,
  evidence_hash text,
  processed boolean NOT NULL DEFAULT false,   -- amendment §B
  processed_at timestamptz,                    -- amendment §B
  created_at timestamptz DEFAULT now()
);
