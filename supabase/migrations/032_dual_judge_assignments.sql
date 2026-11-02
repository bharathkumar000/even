-- ==============================================================================
-- IVC PULSE: Dual-Judge Assignment Support
-- File: supabase/migrations/032_dual_judge_assignments.sql
--
-- Extends judge_assignments with round scoping and enforces a hard database
-- level maximum of TWO distinct judges per team per round.
--
-- Design:
--   * judge_assignments gains a round_id column so the same team can be
--     assigned two different judges in different rounds.
--   * The unique constraint becomes (judge_id, team_id, round_id), so the
--     same judge cannot be assigned twice to the same team in the same round.
--   * A BEFORE INSERT/UPDATE trigger serializes concurrent writes per
--     (team_id, round_id) via pg_advisory_xact_lock and rejects any insert
--     that would add a third distinct judge to a team in a round.
-- ==============================================================================

-- 1. Add round scoping to judge_assignments (nullable so legacy rows keep working)
ALTER TABLE public.judge_assignments
  ADD COLUMN IF NOT EXISTS round_id UUID REFERENCES public.evaluation_rounds(id) ON DELETE CASCADE;

-- 2. Replace the legacy (judge_id, team_id) uniqueness with (judge_id, team_id, round_id)
ALTER TABLE public.judge_assignments
  DROP CONSTRAINT IF EXISTS uq_judge_team;

ALTER TABLE public.judge_assignments
  ADD CONSTRAINT uq_judge_team_round UNIQUE (judge_id, team_id, round_id);

-- 3. Helpful lookups
CREATE INDEX IF NOT EXISTS idx_judge_assignments_round ON public.judge_assignments(round_id);
CREATE INDEX IF NOT EXISTS idx_judge_assignments_team_round ON public.judge_assignments(team_id, round_id);
CREATE INDEX IF NOT EXISTS idx_judge_assignments_judge_round ON public.judge_assignments(judge_id, round_id);

-- 4. Backfill legacy assignments to the first open round so they remain visible
--    (admin can re-assign per round from the UI). Safe to run multiple times.
UPDATE public.judge_assignments ja
SET round_id = (
  SELECT er.id
  FROM public.evaluation_rounds er
  ORDER BY er.sequence_order ASC NULLS LAST, er.created_at ASC
  LIMIT 1
)
WHERE ja.round_id IS NULL
  AND EXISTS (SELECT 1 FROM public.evaluation_rounds);

-- 5. Database-level guard: max two distinct judges per team per round.
--
--    PostgreSQL has no native "max N rows per group" constraint, so a trigger
--    is the reliable mechanism. pg_advisory_xact_lock serializes concurrent
--    assignment attempts for the same (team_id, round_id) so two simultaneous
--    requests cannot both observe a count of 1 and each insert a third judge.
CREATE OR REPLACE FUNCTION public.enforce_max_two_judges_per_team_round()
RETURNS trigger AS $$
DECLARE
  existing_count INT;
BEGIN
  -- Legacy rows without a round are not governed by the per-round rule.
  IF NEW.round_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Serialize concurrent mutations for this team + round.
  PERFORM pg_advisory_xact_lock(
    hashtext('ivc_judge_assignments:' || NEW.team_id::text || ':' || NEW.round_id::text)
  );

  -- Count distinct judges already assigned to this team+round, excluding the
  -- judge being (re)assigned in this very row.
  SELECT COUNT(DISTINCT judge_id)
  INTO existing_count
  FROM public.judge_assignments
  WHERE team_id = NEW.team_id
    AND round_id = NEW.round_id
    AND judge_id <> NEW.judge_id;

  -- If two *other* judges are already assigned, this row would be a third.
  IF existing_count >= 2 THEN
    RAISE EXCEPTION
      'max_two_judges_per_team_round: team % already has 2 judges in round %. A third judge cannot be assigned.',
      NEW.team_id, NEW.round_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_max_two_judges_per_team_round ON public.judge_assignments;

CREATE TRIGGER trg_enforce_max_two_judges_per_team_round
BEFORE INSERT OR UPDATE OF judge_id, team_id, round_id ON public.judge_assignments
FOR EACH ROW EXECUTE FUNCTION public.enforce_max_two_judges_per_team_round();

-- 6. Keep realtime publication in sync for the new column (if publication exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) AND EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'judge_assignments'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'judge_assignments'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.judge_assignments;
    END IF;
  END IF;
END $$;

COMMENT ON TABLE public.judge_assignments IS 'Judge-to-team assignments scoped per evaluation round. Hard limit of 2 distinct judges per team per round enforced by trigger trg_enforce_max_two_judges_per_team_round.';
COMMENT ON COLUMN public.judge_assignments.round_id IS 'Evaluation round this assignment applies to. Null = legacy/unscoped assignment.';
