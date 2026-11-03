-- ==============================================================================
-- IVC PULSE: Lunch & Snacks Team Distribution Limits
-- Migration: 040_lunch_snacks_team_distribution_limits.sql
--
-- Purpose:
--   Enforce a hard database-level maximum of three successful distribution
--   records per team per distribution type (lunch / snacks), serialized for
--   concurrency safety. Each team has one shared QR code and three members;
--   each successful scan claims one member's lunch or snacks, up to 3/3 each.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Database-level guard: max three successful records per (team_id, action_type)
--    for lunch and snacks only.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_max_three_per_team_distribution()
RETURNS trigger AS $$
DECLARE
  existing_count INT;
BEGIN
  -- Only enforce for lunch and snacks distribution types.
  IF NEW.action_type NOT IN ('lunch', 'snacks') THEN
    RETURN NEW;
  END IF;

  -- Only enforce successful claim records (not failures / already_completed).
  IF NEW.result IS DISTINCT FROM 'success' THEN
    RETURN NEW;
  END IF;

  -- team_id must be set for the per-team limit to apply.
  IF NEW.team_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Serialize concurrent mutations for this team + distribution type.
  PERFORM pg_advisory_xact_lock(
    hashtext('ivc_team_distribution:' || NEW.team_id::text || ':' || NEW.action_type)
  );

  -- Count existing successful records for this team + distribution type.
  SELECT COUNT(*) INTO existing_count
  FROM public.event_activity_logs
  WHERE team_id = NEW.team_id
    AND action_type = NEW.action_type
    AND result = 'success';

  -- If three or more successful records already exist, reject this insert.
  IF existing_count >= 3 THEN
    RAISE EXCEPTION
      'max_three_per_team_distribution: team % already has 3 successful % claims. No more allowed.',
      NEW.team_id, NEW.action_type;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_max_three_per_team_distribution ON public.event_activity_logs;

CREATE TRIGGER trg_enforce_max_three_per_team_distribution
BEFORE INSERT ON public.event_activity_logs
FOR EACH ROW EXECUTE FUNCTION public.enforce_max_three_per_team_distribution();

-- ------------------------------------------------------------------------------
-- 2. Supporting index for fast limit checks.
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_event_activity_logs_team_action_success
  ON public.event_activity_logs (team_id, action_type)
  WHERE team_id IS NOT NULL AND result = 'success';

-- ------------------------------------------------------------------------------
-- 3. Comments.
-- ------------------------------------------------------------------------------
COMMENT ON TRIGGER trg_enforce_max_three_per_team_distribution ON public.event_activity_logs IS
  'Enforces a maximum of three successful lunch or snacks distribution records per team per distribution type.';

-- End of migration
