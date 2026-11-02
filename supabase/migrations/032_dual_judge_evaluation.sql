-- ==============================================================================
-- 032_dual_judge_evaluation.sql
-- Dual-Judge Evaluation System: per-round judge assignments with 50-mark cap
-- ==============================================================================

-- ------------------------------------------------------------
-- 1. Add round_id to judge_assignments for per-round assignment support
-- ------------------------------------------------------------

ALTER TABLE public.judge_assignments
  ADD COLUMN IF NOT EXISTS round_id UUID REFERENCES public.evaluation_rounds(id) ON DELETE CASCADE;

-- Create index for the new column
CREATE INDEX IF NOT EXISTS idx_judge_assignments_round_id ON public.judge_assignments (round_id);

-- ------------------------------------------------------------
-- 2. Update unique constraint: one judge per team per round (not just per team)
-- ------------------------------------------------------------

-- Drop old constraint (judge_id, team_id) -- prevent duplicate assignment regardless of round
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_judge_team'
      AND conrelid = 'public.judge_assignments'::regclass
  ) THEN
    ALTER TABLE public.judge_assignments
      DROP CONSTRAINT uq_judge_team;
  END IF;
END $$;

-- Add new constraint: one judge per team per round
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_judge_team_round'
      AND conrelid = 'public.judge_assignments'::regclass
  ) THEN
    ALTER TABLE public.judge_assignments
      ADD CONSTRAINT uq_judge_team_round UNIQUE (judge_id, team_id, round_id);
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3. Backfill round_id for existing judge assignments (use the open round)
-- ------------------------------------------------------------

UPDATE public.judge_assignments ja
SET round_id = (
  SELECT er.id FROM public.evaluation_rounds er
  WHERE er.status = 'open'
  ORDER BY er.sequence_order ASC
  LIMIT 1
)
WHERE ja.round_id IS NULL;

-- ------------------------------------------------------------
-- 4. RLS: judges can view their own assignments (including round context)
-- ------------------------------------------------------------

-- The existing policy "Judges and admins can view assignments" already covers SELECT
-- for judge_id = auth.uid() OR is_admin(). The new round_id column is automatically
-- included since it's part of the same row.

-- ------------------------------------------------------------
-- 5. Update evaluation_criteria max_marks to sum to 50 per judge
-- ------------------------------------------------------------

-- Update existing seed criteria to sum to 50 (25 + 25)
UPDATE public.evaluation_criteria
SET max_marks = 25
WHERE round_id = (
  SELECT id FROM public.evaluation_rounds WHERE status = 'open' ORDER BY sequence_order ASC LIMIT 1
)
AND title IN ('Innovation', 'Technical Execution');

-- If the above update didn't match (different round/criteria), add new criteria to reach 50
INSERT INTO public.evaluation_criteria (round_id, title, description, max_marks, is_required)
SELECT
  er.id,
  'Presentation & Delivery',
  'Clarity, structure, and effectiveness of presentation',
  25,
  true
FROM public.evaluation_rounds er
WHERE er.status = 'open'
  AND NOT EXISTS (
    SELECT 1 FROM public.evaluation_criteria ec
    WHERE ec.round_id = er.id
      AND ec.title = 'Presentation & Delivery'
  )
ORDER BY er.sequence_order ASC
LIMIT 1;

-- ------------------------------------------------------------
-- 6. Seed a second judge for testing dual-judge evaluations
-- ------------------------------------------------------------

INSERT INTO public.profiles (id, email, full_name, role) VALUES
  ('a5555555-5555-5555-5555-555555555555', 'judge2@ivc.com', 'Judge Michael', 'judge')
ON CONFLICT (id) DO UPDATE SET role = 'judge', full_name = 'Judge Michael';

-- Assign second judge to the same team as first judge for the open round
INSERT INTO public.judge_assignments (judge_id, team_id, round_id)
SELECT
  'a5555555-5555-5555-5555-555555555555',
  t.id,
  er.id
FROM public.teams t
CROSS JOIN public.evaluation_rounds er
WHERE er.status = 'open'
  AND t.name = 'Alpha Coders'
  AND NOT EXISTS (
    SELECT 1 FROM public.judge_assignments ja
    WHERE ja.judge_id = 'a5555555-5555-5555-5555-555555555555'
      AND ja.team_id = t.id
      AND ja.round_id = er.id
  )
ORDER BY er.sequence_order ASC
LIMIT 1;

-- Also backfill any existing judge_assignments that still lack round_id
-- (assign them to the first open round if available)
UPDATE public.judge_assignments ja
SET round_id = (
  SELECT er.id FROM public.evaluation_rounds er
  WHERE er.status = 'open'
  ORDER BY er.sequence_order ASC
  LIMIT 1
)
WHERE ja.round_id IS NULL;

-- ------------------------------------------------------------
-- 7. Add check constraint on evaluations total_score <= 50 per judge
--    (defense in depth; server-side validation is primary)
-- ------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_evaluations_total_score_max_50'
      AND conrelid = 'public.evaluations'::regclass
  ) THEN
    ALTER TABLE public.evaluations
      ADD CONSTRAINT chk_evaluations_total_score_max_50
      CHECK (total_score <= 50);
  END IF;
END $$;

-- ------------------------------------------------------------
-- 8. Grant permissions
-- ------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON public.judge_assignments TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- End of migration
