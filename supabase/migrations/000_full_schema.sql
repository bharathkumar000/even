-- ============================================================================
-- IVC PULSE: FULL SCHEMA DUMP
-- Combined schema from all migrations (001_initial_schema.sql through 006_realtime_activity_logs.sql)
-- This file can be used to bootstrap a fresh Supabase instance with the complete database structure.
-- ============================================================================

-- ==================== Migration 001: Initial Schema ====================
-- (Content of supabase/migrations/001_initial_schema.sql)

-- ==============================================================================
-- IVC PULSE: Complete Self-Contained Database Architecture Migration
-- Target: Supabase PostgreSQL (auth schema integration + RLS + Triggers)
-- File: supabase/migrations/001_initial_schema.sql
-- ==============================================================================

-- ----------------------------------------------------------------------------
-- 1. ENUM TYPES
-- ----------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'judge', 'staff', 'organizer', 'participant');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE team_member_role AS ENUM ('leader', 'member');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE round_status AS ENUM ('draft', 'open', 'closed', 'locked', 'reopened');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE evaluation_status AS ENUM ('draft', 'submitted', 'locked', 'reopened');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE action_type AS ENUM ('registration', 'goodies', 'lunch', 'snacks');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ----------------------------------------------------------------------------
-- 2. TABLE SCHEMAS & CONSTRAINTS
-- ----------------------------------------------------------------------------

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    role user_role NOT NULL DEFAULT 'participant',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. EVENTS
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. TEAMS
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    track TEXT,
    leader_name TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. TEAM MEMBERS
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role team_member_role NOT NULL DEFAULT 'member',
    name TEXT,
    email TEXT,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_team_member UNIQUE (team_id, user_id)
);

-- 5. EVALUATION ROUNDS
CREATE TABLE IF NOT EXISTS public.evaluation_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    sequence_order INT NOT NULL DEFAULT 1,
    status round_status NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. EVALUATION CRITERIA (WITH criteria ALIAS VIEW)
CREATE TABLE IF NOT EXISTS public.evaluation_criteria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id UUID NOT NULL REFERENCES public.evaluation_rounds(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    max_marks NUMERIC NOT NULL CHECK (max_marks > 0),
    is_required BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE VIEW public.criteria AS
    SELECT * FROM public.evaluation_criteria;

-- 7. JUDGE ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.judge_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    judge_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_judge_team UNIQUE (judge_id, team_id)
);

-- 8. EVALUATIONS
CREATE TABLE IF NOT EXISTS public.evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id UUID NOT NULL REFERENCES public.evaluation_rounds(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    judge_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    scores JSONB NOT NULL DEFAULT '[]'::jsonb,
    scores_breakdown JSONB DEFAULT '[]'::jsonb,
    total_score NUMERIC DEFAULT 0,
    status evaluation_status NOT NULL DEFAULT 'draft',
    feedback TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_round_team_judge UNIQUE (round_id, team_id, judge_id)
);

-- 9. TEAM SUBMISSIONS (WITH submissions ALIAS VIEW)
CREATE TABLE IF NOT EXISTS public.team_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    round_id UUID NOT NULL REFERENCES public.evaluation_rounds(id) ON DELETE CASCADE,
    ppt_url TEXT NOT NULL,
    github_url TEXT,
    pitch_deck_url TEXT,
    prototype_url TEXT,
    additional_material_url TEXT,
    demo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_team_round_submission UNIQUE (team_id, round_id)
);

CREATE OR REPLACE VIEW public.submissions AS
    SELECT * FROM public.team_submissions;

-- 10. EVENT RESULTS
CREATE TABLE IF NOT EXISTS public.event_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    total_score NUMERIC DEFAULT 0,
    average_score NUMERIC DEFAULT 0,
    evaluations_count INT DEFAULT 0,
    rank INT,
    is_published BOOLEAN NOT NULL DEFAULT false,
    is_locked BOOLEAN NOT NULL DEFAULT false,
    published_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now(),
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_event_team UNIQUE (event_id, team_id)
);

-- 11. EVENT ACTIVITY LOGS (Duplicate claim prevention via unique index)
CREATE TABLE IF NOT EXISTS public.event_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action_type action_type NOT NULL,
    scanned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_participant_action UNIQUE (participant_id, action_type)
);

-- 12. AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    target_entity TEXT,
    target_id UUID,
    reason TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.judge_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: check if authenticated user has admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Profiles Policies
CREATE POLICY "Profiles readable by authenticated users"
ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- 2. Events Policies
CREATE POLICY "Events readable by all"
ON public.events FOR SELECT USING (true);

CREATE POLICY "Admins can manage events"
ON public.events FOR ALL TO authenticated USING (public.is_admin());

-- 3. Teams Policies
CREATE POLICY "Teams readable by authenticated users"
ON public.teams FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage teams"
ON public.teams FOR ALL TO authenticated USING (public.is_admin());

-- 4. Team Members Policies
CREATE POLICY "Team members readable by authenticated users"
ON public.team_members FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage team members"
ON public.team_members FOR ALL TO authenticated USING (public.is_admin());

-- 5. Evaluation Rounds Policies
CREATE POLICY "Rounds readable by authenticated users"
ON public.evaluation_rounds FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage rounds"
ON public.evaluation_rounds FOR ALL TO authenticated USING (public.is_admin());

-- 6. Criteria Policies
CREATE POLICY "Criteria readable by authenticated users"
ON public.criteria FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage criteria"
ON public.criteria FOR ALL TO authenticated USING (public.is_admin());

-- 7. Judge Assignments Policies
CREATE POLICY "Judges and admins can view assignments"
ON public.judge_assignments FOR SELECT TO authenticated
USING (judge_id = auth.uid() OR public.is_admin());

CREATE POLICY "Admins can manage judge assignments"
ON public.judge_assignments FOR ALL TO authenticated USING (public.is_admin());

-- 8. Evaluations Policies
CREATE POLICY "Judges can view and manage their evaluations"
ON public.evaluations FOR ALL TO authenticated
USING (judge_id = auth.uid() OR public.is_admin());

-- 9. Team Submissions Policies
CREATE POLICY "Team members and judges can view submissions"
ON public.team_submissions FOR SELECT TO authenticated
USING (
  public.is_admin() OR
  EXISTS (SELECT 1 FROM public.team_members WHERE team_id = team_submissions.team_id AND user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.judge_assignments WHERE team_id = team_submissions.team_id AND judge_id = auth.uid())
);

CREATE POLICY "Team leaders can manage submissions"
ON public.team_submissions FOR ALL TO authenticated
USING (
  public.is_admin() OR
  EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = team_submissions.team_id
      AND user_id = auth.uid()
      AND role = 'leader'
  )
);

-- 10. Event Results Policies
CREATE POLICY "Results viewable when published or by admin"
ON public.event_results FOR SELECT TO authenticated
USING (
  public.is_admin() OR
  (is_published = true AND EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = event_results.team_id AND user_id = auth.uid()
  ))
);

-- 11. Event Activity Logs Policies
CREATE POLICY "Staff and admins can view and record activity logs"
ON public.event_activity_logs FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'staff', 'organizer')
  )
);

-- 12. Audit Logs Policies
CREATE POLICY "Audit logs only viewable by admins"
ON public.audit_logs FOR SELECT TO authenticated
USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. TRIGGERS (Auto-Profile Creation on auth.users Signup)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, created_at)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    COALESCE((new.raw_user_meta_data->>'role')::user_role, 'participant'::user_role),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- Migration 002: RBAC & Profile Security
-- ==============================================================================

-- 1. EXTEND USER ROLE ENUM TO INCLUDE 'leader'
DO $$ BEGIN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'leader';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. HARDENED TRIGGER: Automatic Participant Default on Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    created_at
  )
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    'participant'::user_role,
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name);
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2.5 FIX SUPABASE AUTH NULL TOKEN BUG
UPDATE auth.users
SET 
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change = COALESCE(email_change, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  reauthentication_token = COALESCE(reauthentication_token, '')
WHERE 
  confirmation_token IS NULL
  OR recovery_token IS NULL
  OR email_change_token_new IS NULL
  OR email_change IS NULL
  OR phone_change IS NULL
  OR phone_change_token IS NULL
  OR email_change_token_current IS NULL
  OR reauthentication_token IS NULL;

-- 3. HELPER FUNCTION: Check Admin Role Safely
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (current_user = 'postgres' OR auth.role() = 'service_role') THEN
    RETURN true;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- 4. DATABASE-LEVEL DEFENSE: Prevent Non-Admins From Modifying the 'role' Column
CREATE OR REPLACE FUNCTION public.prevent_non_admin_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: Only administrators can modify user roles or elevate permissions.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_role_change_permissions ON public.profiles;
CREATE TRIGGER enforce_role_change_permissions
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_non_admin_role_change();

-- 5. ROW LEVEL SECURITY (RLS) POLICIES FOR public.profiles (NON-RECURSIVE)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles readable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins have full access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile non-role fields" ON public.profiles;

CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update own profile non-role fields"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins have full access to profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ==============================================================================
-- Migration 003: Schema Alignment & Compatibility Patch
-- ==============================================================================

-- 1. EXTEND TEAMS TABLE WITH MISSING FIELDS (track, leader_name, status)
ALTER TABLE IF EXISTS public.teams
  ADD COLUMN IF NOT EXISTS track TEXT,
  ADD COLUMN IF NOT EXISTS leader_name TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- 2. EXTEND AUDIT_LOGS TABLE WITH APPLIED FIELD NAMES (entity_type, entity_id, details)
ALTER TABLE IF EXISTS public.audit_logs
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id TEXT,
  ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;

UPDATE public.audit_logs
SET
  entity_type = COALESCE(entity_type, target_entity),
  entity_id = COALESCE(entity_id, target_id::text),
  details = COALESCE(details, metadata)
WHERE entity_type IS NULL OR entity_id IS NULL OR details IS NULL;

-- 3. EXTEND EVENT_RESULTS WITH STATISTICAL & AUDIT FIELDS
ALTER TABLE IF EXISTS public.event_results
  ADD COLUMN IF NOT EXISTS average_score NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS evaluations_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 4. EXTEND EVALUATIONS TABLE WITH SCORES BREAKDOWN & EVENT LINK
ALTER TABLE IF EXISTS public.evaluations
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS scores_breakdown JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 5. HARMONIZE EVALUATION CRITERIA TABLE & ALIAS VIEW
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'criteria')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'evaluation_criteria') THEN
    ALTER TABLE public.criteria RENAME TO evaluation_criteria;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'evaluation_criteria') THEN
    CREATE TABLE public.evaluation_criteria (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      round_id UUID NOT NULL REFERENCES public.evaluation_rounds(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      max_marks NUMERIC NOT NULL CHECK (max_marks > 0),
      is_required BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  END IF;
END $$;

ALTER TABLE IF EXISTS public.evaluation_criteria
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE OR REPLACE VIEW public.criteria AS
  SELECT * FROM public.evaluation_criteria;

-- 6. EXTEND TEAM_MEMBERS WITH CONTACT FIELDS
ALTER TABLE IF EXISTS public.team_members
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT;

-- 7. SUBMISSIONS COMPATIBILITY VIEW (ALIASES team_submissions to submissions)
CREATE OR REPLACE VIEW public.submissions AS
  SELECT * FROM public.team_submissions;

-- 8. ROW LEVEL SECURITY & POLICY UPDATES
ALTER TABLE IF EXISTS public.evaluation_criteria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Evaluation criteria readable by authenticated" ON public.evaluation_criteria;
CREATE POLICY "Evaluation criteria readable by authenticated"
  ON public.evaluation_criteria
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage evaluation criteria" ON public.evaluation_criteria;
CREATE POLICY "Admins can manage evaluation criteria"
  ON public.evaluation_criteria
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins and service can insert audit logs" ON public.audit_logs;
CREATE POLICY "Admins and service can insert audit logs"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Storage Bucket for team deliverable files (PPT, PPTX, PDF, DOCX)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'team-deliverables',
  'team-deliverables',
  true,
  52428800,
  ARRAY[
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800;

-- Storage public read policy
DROP POLICY IF EXISTS "Public can view team deliverables" ON storage.objects;
CREATE POLICY "Public can view team deliverables"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'team-deliverables');

-- Storage authenticated insert policy
DROP POLICY IF EXISTS "Authenticated users can upload team deliverables" ON storage.objects;
CREATE POLICY "Authenticated users can upload team deliverables"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'team-deliverables');

-- Add Problem & Solution fields to team_submissions
ALTER TABLE public.team_submissions
  ADD COLUMN IF NOT EXISTS problem_statement TEXT,
  ADD COLUMN IF NOT EXISTS problem_description TEXT,
  ADD COLUMN IF NOT EXISTS proposed_solution TEXT,
  ADD COLUMN IF NOT EXISTS solution_description TEXT;

-- Refresh submissions view
CREATE OR REPLACE VIEW public.submissions AS
  SELECT * FROM public.team_submissions;

-- Role Helper Functions (Ensures is_admin and has_role exist with explicit types)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(user_id UUID, required_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = required_role
  );
$$;

-- Announcements System (Broadcasts from Admin/Organizers to all portals)
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal',
    target_audience TEXT NOT NULL DEFAULT 'all',
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can view active announcements" ON public.announcements;
CREATE POLICY "Anyone authenticated can view active announcements"
    ON public.announcements FOR SELECT
    TO authenticated
    USING (is_active = true);

DROP POLICY IF EXISTS "Admins and staff can manage announcements" ON public.announcements;
CREATE POLICY "Admins and staff can manage announcements"
    ON public.announcements FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'staff', 'organizer')
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'staff', 'organizer')
      )
    );

-- ==============================================================================
-- Migration 004: SPOC Management
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.spocs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    department TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_spoc_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spoc_id UUID NOT NULL REFERENCES public.spocs(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    allotted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_team_spoc UNIQUE (team_id)
);

CREATE INDEX IF NOT EXISTS idx_team_spoc_spoc_id ON public.team_spoc_assignments(spoc_id);
CREATE INDEX IF NOT EXISTS idx_team_spoc_team_id ON public.team_spoc_assignments(team_id);

ALTER TABLE public.spocs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_spoc_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage spocs"
    ON public.spocs
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Authenticated users can view spocs"
    ON public.spocs
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can manage spoc assignments"
    ON public.team_spoc_assignments
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Authenticated users can view spoc assignments"
    ON public.team_spoc_assignments
    FOR SELECT
    TO authenticated
    USING (true);

-- ==============================================================================
-- Migration 005: SPOC Avatar Support
-- ==============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'spocs'
          AND column_name = 'avatar_url'
    ) THEN
        ALTER TABLE public.spocs ADD COLUMN avatar_url TEXT;
    END IF;
END $$;

-- ==============================================================================
-- Migration 006: Real-time QR Verification, Live Synchronization & Anti-Fraud
-- ==============================================================================

-- 1. ADD QR TELEMETRY & ANTI-FRAUD TOKENS TO TEAMS TABLE
ALTER TABLE IF EXISTS public.teams
  ADD COLUMN IF NOT EXISTS qr_token TEXT,
  ADD COLUMN IF NOT EXISTS last_scanned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_scanned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. ENSURE REPLICA IDENTITY FULL FOR LIVE PAYLOAD TRANSMISSION
ALTER TABLE IF EXISTS public.event_activity_logs REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.teams REPLICA IDENTITY FULL;

-- 3. ENABLE SUPABASE REALTIME PUBLICATION FOR LOGS & TEAMS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'event_activity_logs'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.event_activity_logs;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'teams'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
    END IF;
  END IF;
END $$;

-- 4. PERMIT TEAM PARTICIPANTS TO SELECT OWN TEAM'S ACTIVITY LOGS FOR LIVE QR
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'event_activity_logs' 
      AND policyname = 'Team participants can view own team activity logs'
  ) THEN
    CREATE POLICY "Team participants can view own team activity logs"
    ON public.event_activity_logs FOR SELECT TO authenticated
    USING (
      team_id IN (
        SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- 5. ENSURE STAFF AND ADMINS CAN READ AND INSERT ACTIVITY LOGS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'event_activity_logs' 
      AND policyname = 'Staff and admins can manage event activity logs'
  ) THEN
    CREATE POLICY "Staff and admins can manage event activity logs"
    ON public.event_activity_logs FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'staff', 'organizer')
      )
    );
  END IF;
END $$;

-- ==============================================================================
-- End of Full Schema Dump
-- ==============================================================================
