-- ==============================================================================
-- IVC PULSE: Round-Specific Judge Assignment Support
-- File: supabase/migrations/035_round_specific_judge_assignments.sql
--
-- Adds round_id column to judge_assignments so the same team can be assigned
-- two different judges in different evaluation rounds.
--
-- Design:
--   * judge_assignments gains a nullable round_id column referencing
--     public.evaluation_rounds(id). Null = legacy/unscoped assignment.
--   * Unique constraint becomes (judge_id, team_id, round_id), so the same
--     judge cannot be assigned twice to the same team in the same round.
--   * BEFORE INSERT/UPDATE trigger enforces max two distinct judges per
--     team per round, serialized via pg_advisory_xact_lock for concurrency safety.
-- ==============================================================================

-- ------------------------------------------------------------
-- 1. Add round_id column (idempotent)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'judge_assignments'
      AND column_name = 'round_id'
  ) THEN
    ALTER TABLE public.judge_assignments
      ADD COLUMN round_id UUID REFERENCES public.evaluation_rounds(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. Replace legacy unique constraint with round-scoped one
-- ------------------------------------------------------------
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
-- 3. Helpful indexes (idempotent)
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_judge_assignments_round ON public.judge_assignments(round_id);
CREATE INDEX IF NOT EXISTS idx_judge_assignments_team_round ON public.judge_assignments(team_id, round_id);
CREATE INDEX IF NOT EXISTS idx_judge_assignments_judge_round ON public.judge_assignments(judge_id, round_id);

-- ------------------------------------------------------------
-- 4. Database-level guard: max two distinct judges per team per round
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 5. Realtime publication sync (if publication exists)
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 6. Comments
-- ------------------------------------------------------------
COMMENT ON TABLE public.judge_assignments IS 'Judge-to-team assignments scoped per evaluation round. Hard limit of 2 distinct judges per team per round enforced by trigger trg_enforce_max_two_judges_per_team_round.';
COMMENT ON COLUMN public.judge_assignments.round_id IS 'Evaluation round this assignment applies to. Null = legacy/unscoped assignment.';

-- ------------------------------------------------------------
-- 7. Grants
-- ------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.judge_assignments TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- End of migration
