-- ==============================================================================
-- IVC PULSE / EVENTRA: Relaython Activity Limits & Idempotent Check-in
-- Migration: 047_relaython_activity_limits.sql
--
-- Purpose:
--   1. Create public.relaython_activity_counters to track successful scan counts
--      per team per activity type (replaces single-success unique index).
--   2. Initialize counters from existing successful rows in relaython_activity_logs
--      WITHOUT overwriting existing counters on reruns.
--   3. Replace uq_relaython_successful_checkin with correlation_id idempotency
--      index (unique across ALL results, not just success).
--   4. Create public.relaython_record_checkin() RPC for atomic, concurrency-safe
--      check-in recording with per-activity limits:
--         registration: 1
--         snacks_1:     4
--         lunch:        4
--         snacks_2:     4
--
-- Concurrency safety:
--   pg_advisory_xact_lock on correlation_id hash serializes retries with the
--   same idempotency key, so concurrent requests never double-consume.
--   Counter row is locked with FOR UPDATE before incrementing.
--
-- Permissions:
--   EXECUTE is REVOKED from PUBLIC. Not granted to authenticated or anon.
--   Only the Eventra server backend (service_role) can invoke the RPC.
--
-- Non-destructive: preserves all existing rows in relaython_activity_logs and
-- relaython_qr_registry. No legacy Eventra tables are touched.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Activity counters table (one row per team_code + action_type)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.relaython_activity_counters (
  team_code TEXT NOT NULL,
  action_type TEXT NOT NULL
    CHECK (action_type IN ('registration', 'goodies', 'lunch', 'snacks', 'snacks_1', 'snacks_2', 'certificates')),
  successful_count INTEGER NOT NULL DEFAULT 0
    CHECK (successful_count >= 0),
  PRIMARY KEY (team_code, action_type)
);

COMMENT ON TABLE public.relaython_activity_counters IS
  'Tracks successful Relaython scan counts per team per activity type. '
  'Used by relaython_record_checkin() RPC to enforce per-activity limits.';

-- ------------------------------------------------------------------------------
-- 2. Initialize counters from existing successful log rows.
--    INSERT ... ON CONFLICT DO NOTHING preserves existing counters on reruns.
-- ------------------------------------------------------------------------------
INSERT INTO public.relaython_activity_counters (team_code, action_type, successful_count)
SELECT team_code, action_type, count(*)
FROM public.relaython_activity_logs
WHERE result = 'success'
GROUP BY team_code, action_type
ON CONFLICT (team_code, action_type) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 3. Replace restrictive unique index with correlation_id idempotency.
--    Unique across ALL results so retries with same key are detected.
-- ------------------------------------------------------------------------------
DROP INDEX IF EXISTS public.uq_relaython_successful_checkin;

CREATE UNIQUE INDEX IF NOT EXISTS uq_relaython_activity_logs_correlation_id
  ON public.relaython_activity_logs (correlation_id);

-- ------------------------------------------------------------------------------
-- 4. RPC: atomic, concurrency-safe Relaython check-in recording.
--    PL/pgSQL function body is a single transaction: counter + log updates
--    occur atomically.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.relaython_record_checkin(
  p_team_code TEXT,
  p_action_type TEXT,
  p_qr_token TEXT,
  p_correlation_id UUID,
  p_operator_id UUID,
  p_operator_name TEXT,
  p_operator_role TEXT,
  p_method TEXT DEFAULT 'qr'
)
RETURNS TABLE (
  status TEXT,
  message TEXT,
  team_code TEXT,
  action_type TEXT,
  successful_count INTEGER,
  limit_reached BOOLEAN,
  already_completed BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_limit INTEGER;
  v_current_count INTEGER;
  v_log_id UUID;
  v_prev_result TEXT;
BEGIN
  -- --------------------------------------------------------------------------
  -- Serialize concurrent requests with the same correlation_id so retries
  -- never consume an additional serving or raise an unhandled error.
  -- --------------------------------------------------------------------------
  PERFORM pg_advisory_xact_lock(
    hashtext('ivc_relaython_checkin:' || p_correlation_id::text)
  );

  -- --------------------------------------------------------------------------
  -- Idempotency: if correlation_id already exists, return prior result.
  -- --------------------------------------------------------------------------
  SELECT id, result INTO v_log_id, v_prev_result
  FROM public.relaython_activity_logs
  WHERE correlation_id = p_correlation_id;

  IF v_log_id IS NOT NULL THEN
    IF v_prev_result = 'success' THEN
      RETURN QUERY SELECT
        'already_completed'::TEXT,
        'Already completed: ' || p_action_type || ' for team ' || p_team_code,
        p_team_code,
        p_action_type,
        COALESCE((
          SELECT successful_count FROM public.relaython_activity_counters
          WHERE team_code = p_team_code AND action_type = p_action_type
        ), 0),
        FALSE,
        TRUE;
    ELSE
      RETURN QUERY SELECT
        v_prev_result::TEXT,
        'Previous attempt ' || v_prev_result || ' for correlation_id ' || p_correlation_id::TEXT,
        p_team_code,
        p_action_type,
        COALESCE((
          SELECT successful_count FROM public.relaython_activity_counters
          WHERE team_code = p_team_code AND action_type = p_action_type
        ), 0),
        FALSE,
        FALSE;
    END IF;
    RETURN;
  END IF;

  -- --------------------------------------------------------------------------
  -- Validate action type: only the four Relaython activities are allowed.
  -- --------------------------------------------------------------------------
  CASE p_action_type
    WHEN 'registration' THEN v_limit := 1;
    WHEN 'snacks_1'     THEN v_limit := 4;
    WHEN 'lunch'        THEN v_limit := 4;
    WHEN 'snacks_2'     THEN v_limit := 4;
    ELSE                     v_limit := 0;
  END CASE;

  IF v_limit = 0 THEN
    RETURN QUERY SELECT
      'error'::TEXT,
      'Action type ' || p_action_type || ' is not a valid Relaython check-in activity',
      p_team_code,
      p_action_type,
      0,
      FALSE,
      FALSE;
    RETURN;
  END IF;

  -- --------------------------------------------------------------------------
  -- Ensure counter row exists, then lock it for this transaction.
  -- --------------------------------------------------------------------------
  INSERT INTO public.relaython_activity_counters (team_code, action_type, successful_count)
  VALUES (p_team_code, p_action_type, 0)
  ON CONFLICT (team_code, action_type) DO NOTHING;

  SELECT successful_count INTO v_current_count
  FROM public.relaython_activity_counters
  WHERE team_code = p_team_code AND action_type = p_action_type
  FOR UPDATE;

  -- --------------------------------------------------------------------------
  -- Limit check: reject if at or over the limit.
  -- --------------------------------------------------------------------------
  IF v_current_count >= v_limit THEN
    RETURN QUERY SELECT
      'limit_reached'::TEXT,
      'Limit of ' || v_limit || ' reached for ' || p_action_type || ' (team ' || p_team_code || ')',
      p_team_code,
      p_action_type,
      v_current_count,
      TRUE,
      FALSE;
    RETURN;
  END IF;

  -- --------------------------------------------------------------------------
  -- Record successful log entry.
  -- --------------------------------------------------------------------------
  INSERT INTO public.relaython_activity_logs (
    team_code, qr_token, action_type, scanned_by, operator_id, operator_name,
    operator_role, method, result, correlation_id, created_at
  ) VALUES (
    p_team_code, p_qr_token, p_action_type, p_operator_id, p_operator_id,
    p_operator_name, p_operator_role, p_method, 'success', p_correlation_id, now()
  ) RETURNING id INTO v_log_id;

  -- --------------------------------------------------------------------------
  -- Increment counter (same transaction as the log insert above).
  -- --------------------------------------------------------------------------
  UPDATE public.relaython_activity_counters
  SET successful_count = successful_count + 1
  WHERE team_code = p_team_code AND action_type = p_action_type;

  SELECT successful_count INTO v_current_count
  FROM public.relaython_activity_counters
  WHERE team_code = p_team_code AND action_type = p_action_type;

  RETURN QUERY SELECT
    'success'::TEXT,
    'Check-in recorded: ' || p_action_type || ' #' || v_current_count || ' for team ' || p_team_code,
    p_team_code,
    p_action_type,
    v_current_count,
    FALSE,
    FALSE;
  RETURN;
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. Permissions: REVOKE from PUBLIC. Do NOT grant to authenticated or anon.
--    Only the Eventra server backend (service_role key) can invoke the RPC.
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.relaython_record_checkin(
  TEXT, TEXT, TEXT, UUID, UUID, TEXT, TEXT, TEXT
) FROM PUBLIC;

-- ------------------------------------------------------------------------------
-- 6. Realtime publication for counters table (so Live Activity Stream updates).
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'relaython_activity_counters'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.relaython_activity_counters;
    END IF;
  END IF;
END $$;

ALTER TABLE public.relaython_activity_counters REPLICA IDENTITY FULL;

-- ------------------------------------------------------------------------------
-- 7. Row Level Security on counters table (authenticated read only).
-- ------------------------------------------------------------------------------
ALTER TABLE public.relaython_activity_counters ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'relaython_activity_counters'
      AND policyname = 'Authenticated users can read relaython counters'
  ) THEN
    CREATE POLICY "Authenticated users can read relaython counters"
      ON public.relaython_activity_counters
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 8. Verify existing schema before applying changes.
--    relaython_activity_logs must have correlation_id column (from migration 046).
--    relaython_qr_registry must exist (from migration 046).
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'relaython_activity_logs' AND column_name = 'correlation_id'
  ) THEN
    RAISE EXCEPTION 'relaython_activity_logs.correlation_id column missing. Run migration 046 first.'
      USING ERRCODE = '42P01';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'relaython_qr_registry'
  ) THEN
    RAISE EXCEPTION 'public.relaython_qr_registry table missing. Run migration 046 first.'
      USING ERRCODE = '42P01';
  END IF;
END $$;

-- End of migration
