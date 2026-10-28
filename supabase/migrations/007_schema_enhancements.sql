-- ==============================================================================
-- IVC EVENTRA / PULSE: Enterprise Enhancements & Realtime Publication
-- Migration: 007_schema_enhancements.sql
-- ==============================================================================

-- 0. DEFINE HAS_ROLE HELPER (SAFE TYPE CASTING)
CREATE OR REPLACE FUNCTION public.has_role(user_id UUID, required_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role::text = required_role
  );
$$;

-- 1. ADD UPDATED_AT TO EVALUATION_ROUNDS
ALTER TABLE IF EXISTS public.evaluation_rounds
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. ADD VENUE NAVIGATION FIELDS TO TEAMS TABLE
ALTER TABLE IF EXISTS public.teams
  ADD COLUMN IF NOT EXISTS table_number TEXT,
  ADD COLUMN IF NOT EXISTS lab_room TEXT,
  ADD COLUMN IF NOT EXISTS dietary_preference TEXT DEFAULT 'standard';

-- 3. AUTOMATED UPDATED_AT TIMESTAMP TRIGGER
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to evaluation_rounds
DROP TRIGGER IF EXISTS trg_set_updated_at_rounds ON public.evaluation_rounds;
CREATE TRIGGER trg_set_updated_at_rounds
  BEFORE UPDATE ON public.evaluation_rounds
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Attach trigger to evaluation_criteria
DROP TRIGGER IF EXISTS trg_set_updated_at_criteria ON public.evaluation_criteria;
CREATE TRIGGER trg_set_updated_at_criteria
  BEFORE UPDATE ON public.evaluation_criteria
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 4. ANNOUNCEMENTS SYSTEM (ENSURE TABLE EXISTS FOR REALTIME BROADCASTS)
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal', -- 'normal', 'urgent', 'important'
  target_audience TEXT NOT NULL DEFAULT 'all', -- 'all', 'teams', 'judges', 'ops'
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
      WHERE id = auth.uid() AND role::text IN ('admin', 'staff', 'organizer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text IN ('admin', 'staff', 'organizer')
    )
  );

-- 5. JUDGE CONFLICT OF INTEREST (COI) TABLE
CREATE TABLE IF NOT EXISTS public.judge_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judge_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_judge_conflict UNIQUE (judge_id, team_id)
);

ALTER TABLE public.judge_conflicts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage judge conflicts" ON public.judge_conflicts;
CREATE POLICY "Admins can manage judge conflicts"
  ON public.judge_conflicts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text = 'admin'
    )
  );

DROP POLICY IF EXISTS "Judges can view own conflicts" ON public.judge_conflicts;
CREATE POLICY "Judges can view own conflicts"
  ON public.judge_conflicts FOR SELECT
  TO authenticated
  USING (
    judge_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text = 'admin'
    )
  );

-- 6. SUBMISSION VERSION HISTORY (REVISIONS) TABLE
CREATE TABLE IF NOT EXISTS public.submission_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES public.team_submissions(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES public.evaluation_rounds(id) ON DELETE CASCADE,
  version_number INT NOT NULL DEFAULT 1,
  ppt_url TEXT NOT NULL,
  github_url TEXT,
  pitch_deck_url TEXT,
  demo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.submission_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teams can view own submission revisions" ON public.submission_revisions;
CREATE POLICY "Teams can view own submission revisions"
  ON public.submission_revisions FOR SELECT
  TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text IN ('judge', 'admin', 'staff', 'organizer')
    )
  );

DROP POLICY IF EXISTS "Teams can insert own submission revisions" ON public.submission_revisions;
CREATE POLICY "Teams can insert own submission revisions"
  ON public.submission_revisions FOR INSERT
  TO authenticated
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    )
  );

-- 7. ENSURE REPLICA IDENTITY FULL & REALTIME PUBLICATION
ALTER TABLE IF EXISTS public.evaluation_rounds REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.evaluation_criteria REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.announcements REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'evaluation_rounds'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.evaluation_rounds;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'evaluation_criteria'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.evaluation_criteria;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'announcements'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
    END IF;
  END IF;
END $$;
