-- ============================================================
-- VERIFIEDMEASURE ENTERPRISE — SAAS INTELLIGENCE ENGINE
-- SINGLE SOURCE OF TRUTH
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- WORKFLOW ENUM
DO $$ BEGIN
  CREATE TYPE workflow_status AS ENUM
  ('new','triaged','qualified','in_sequence','engaged','won','lost','do_not_contact');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- LEADS
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company text NOT NULL,
  website text,
  domain text,
  logo_url text,
  email text,
  phone text,
  stage text,
  arr_estimate numeric,
  employees integer,
  tech_stack text[],
  intelligence_score integer NOT NULL DEFAULT 0,
  workflow workflow_status DEFAULT 'new',
  is_high_priority boolean DEFAULT false,
  is_archived boolean DEFAULT false,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_intel_idx ON public.leads(intelligence_score DESC);

-- ENTITLEMENT
CREATE TABLE IF NOT EXISTS public.lead_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  granted_at timestamptz DEFAULT now(),
  UNIQUE(user_id, lead_id)
);

-- LEDGER
CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  reason text,
  ref_type text,
  created_at timestamptz DEFAULT now()
);

-- USER PROFILES
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY,
  role text DEFAULT 'user'
);

-- FEATURE FLAGS
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key text PRIMARY KEY,
  enabled boolean DEFAULT false
);

INSERT INTO public.feature_flags (key, enabled)
VALUES
('ENABLE_ANALYTICS_DASHBOARD', true),
('ENABLE_DETAIL_PANEL', true),
('ENABLE_SPARKLINES', true),
('ENABLE_COMMAND_PALETTE', true)
ON CONFLICT DO NOTHING;

-- ANALYTICS
CREATE MATERIALIZED VIEW IF NOT EXISTS public.dashboard_metrics AS
SELECT
  COUNT(*) AS total_companies,
  COALESCE(AVG(intelligence_score),0) AS avg_score
FROM public.leads
WHERE is_archived = false;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.stage_breakdown AS
SELECT
  COALESCE(stage,'Unknown') AS stage,
  COUNT(*) AS company_count
FROM public.leads
GROUP BY COALESCE(stage,'Unknown');

-- RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_preview" ON public.leads FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "lead_access_read_own" ON public.lead_access FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ledger_read_own" ON public.credit_ledger FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- RPC: SECURE UNLOCK
-- ============================================================

CREATE OR REPLACE FUNCTION public.unlock_leads_secure(p_lead_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  uid uuid;
  cost int;
  bal int;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  cost := COALESCE(array_length(p_lead_ids,1),0);

  SELECT COALESCE(SUM(amount),0) INTO bal FROM public.credit_ledger WHERE user_id = uid;

  IF bal < cost THEN RAISE EXCEPTION 'Insufficient credits'; END IF;

  INSERT INTO public.lead_access (user_id, lead_id)
  SELECT uid, unnest(p_lead_ids) ON CONFLICT DO NOTHING;

  INSERT INTO public.credit_ledger (user_id, amount, reason, ref_type)
  VALUES (uid, -cost, 'unlock','unlock');
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlock_leads_secure(uuid[]) TO authenticated;

-- ============================================================
-- RPC: ADMIN CREDIT GRANT
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_grant_credits(p_user_id uuid, p_amount int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE caller uuid;
BEGIN
  caller := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = caller AND role = 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.credit_ledger (user_id, amount, reason, ref_type)
  VALUES (p_user_id, p_amount, 'admin_grant','admin_grant');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_grant_credits(uuid,int) TO authenticated;

-- ============================================================
-- SAMPLE DATA (20 LEADS)
-- ============================================================

INSERT INTO public.leads (company, website, domain, email, phone, stage, arr_estimate, employees, tech_stack, intelligence_score, workflow, is_high_priority)
VALUES
('Acme Corp', 'https://acme.io', 'acme.io', 'contact@acme.io', '+1-555-0100', 'Enterprise', 2500000, 250, ARRAY['React','Node.js','PostgreSQL'], 385, 'qualified', true),
('TechFlow', 'https://techflow.com', 'techflow.com', 'sales@techflow.com', '+1-555-0101', 'Mid-Market', 850000, 85, ARRAY['Vue.js','Python','MongoDB'], 342, 'in_sequence', false),
('DataSync Solutions', 'https://datasync.io', 'datasync.io', 'info@datasync.io', '+1-555-0102', 'SMB', 120000, 12, ARRAY['Angular','Java','MySQL'], 298, 'new', false),
('CloudScale', 'https://cloudscale.co', 'cloudscale.co', 'hello@cloudscale.co', '+1-555-0103', 'Enterprise', 4200000, 420, ARRAY['React','Go','Kubernetes'], 392, 'engaged', true),
('InnovateLabs', 'https://innovatelabs.com', 'innovatelabs.com', 'team@innovatelabs.com', '+1-555-0104', 'SMB', 95000, 8, ARRAY['Svelte','Rust','Redis'], 265, 'triaged', false),
('QuantumLeap', 'https://quantumleap.ai', 'quantumleap.ai', 'contact@quantumleap.ai', '+1-555-0105', 'Enterprise', 3800000, 310, ARRAY['React','Python','TensorFlow'], 375, 'qualified', true),
('NexGen Software', 'https://nexgen.dev', 'nexgen.dev', 'sales@nexgen.dev', '+1-555-0106', 'Mid-Market', 650000, 55, ARRAY['Next.js','TypeScript','Supabase'], 318, 'in_sequence', false),
('BrightPath Analytics', 'https://brightpath.io', 'brightpath.io', 'info@brightpath.io', '+1-555-0107', 'Mid-Market', 920000, 92, ARRAY['React','Scala','Cassandra'], 355, 'engaged', false),
('Velocity Systems', 'https://velocity.tech', 'velocity.tech', 'contact@velocity.tech', '+1-555-0108', 'Enterprise', 5100000, 580, ARRAY['Angular','Java','Oracle'], 398, 'won', true),
('PulseData', 'https://pulsedata.com', 'pulsedata.com', 'hello@pulsedata.com', '+1-555-0109', 'SMB', 180000, 18, ARRAY['Vue.js','PHP','MariaDB'], 282, 'new', false),
('StreamFlow', 'https://streamflow.io', 'streamflow.io', 'team@streamflow.io', '+1-555-0110', 'Mid-Market', 780000, 72, ARRAY['React','Elixir','PostgreSQL'], 338, 'qualified', false),
('CoreTech Industries', 'https://coretech.com', 'coretech.com', 'sales@coretech.com', '+1-555-0111', 'Enterprise', 6200000, 720, ARRAY['React','C#','SQL Server'], 395, 'engaged', true),
('AgileWorks', 'https://agileworks.co', 'agileworks.co', 'info@agileworks.co', '+1-555-0112', 'SMB', 145000, 14, ARRAY['Nuxt.js','Node.js','SQLite'], 272, 'triaged', false),
('DataForge', 'https://dataforge.io', 'dataforge.io', 'contact@dataforge.io', '+1-555-0113', 'Mid-Market', 1100000, 105, ARRAY['React','Spark','Hadoop'], 362, 'in_sequence', false),
('FusionTech', 'https://fusiontech.dev', 'fusiontech.dev', 'hello@fusiontech.dev', '+1-555-0114', 'Enterprise', 3500000, 280, ARRAY['Vue.js','Ruby','Redis'], 378, 'qualified', true),
('Precision Software', 'https://precision.io', 'precision.io', 'team@precision.io', '+1-555-0115', 'SMB', 98000, 9, ARRAY['Gatsby','Node.js','MongoDB'], 258, 'new', false),
('Infinite Loop', 'https://infiniteloop.com', 'infiniteloop.com', 'sales@infiniteloop.com', '+1-555-0116', 'Mid-Market', 820000, 78, ARRAY['React','Python','DynamoDB'], 345, 'engaged', false),
('TechNova', 'https://technova.ai', 'technova.ai', 'info@technova.ai', '+1-555-0117', 'Enterprise', 4700000, 450, ARRAY['React','Go','Kafka'], 388, 'won', true),
('Synergy Solutions', 'https://synergy.co', 'synergy.co', 'contact@synergy.co', '+1-555-0118', 'Mid-Market', 710000, 68, ARRAY['Angular','Spring','PostgreSQL'], 325, 'qualified', false),
('Catalyst Systems', 'https://catalyst.tech', 'catalyst.tech', 'hello@catalyst.tech', '+1-555-0119', 'SMB', 165000, 16, ARRAY['Remix','Deno','SQLite'], 288, 'triaged', false);

COMMIT;
