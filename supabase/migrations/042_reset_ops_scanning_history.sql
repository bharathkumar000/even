-- ==============================================================================
-- IVC PULSE: OPS Scanning History Reset (One-Time)
-- Migration: 042_reset_ops_scanning_history.sql
--
-- PURPOSE:
--   Performs a one-time complete cleanup of all OPS scanning history across
--   every action category. Deletes all participant scanning/activity records
--   from event_activity_logs and all corresponding OPS scan entries from
--   audit_logs.
--
-- PRESERVES:
--   - Participant accounts / profiles
--   - Team registrations and team records
--   - Problem Statement selections
--   - Judge assignments
--   - Evaluation submissions or marks
--   - SPOC assignments
--   - Event configuration
--   - Non-scanner administrative audit records in audit_logs
--
-- SAFETY:
--   - Runs inside a transaction; rollback on any error.
--   - Reports affected record counts per table and action category.
--   - Does not disable future audit logging or modify scanning validation rules.
--   - Not a recurring cleanup; one-time execution only.
-- ==============================================================================

DO $$
DECLARE
  -- Counters for event_activity_logs by action type
  reg_count      INTEGER := 0;
  goodies_count  INTEGER := 0;
  lunch_count    INTEGER := 0;
  snacks_count   INTEGER := 0;
  certificates_count INTEGER := 0;
  other_count    INTEGER := 0;
  total_eal      INTEGER := 0;

  -- Counters for audit_logs by action
  ops_scan_count INTEGER := 0;
  revert_count   INTEGER := 0;
  total_al       INTEGER := 0;

  -- Team counter reset count
  teams_reset    INTEGER := 0;
BEGIN
  -- --------------------------------------------------------------------------
  -- 1. Count event_activity_logs BEFORE deletion (by action type)
  -- --------------------------------------------------------------------------
  SELECT COUNT(*) INTO reg_count
  FROM public.event_activity_logs
  WHERE action_type = 'registration';

  SELECT COUNT(*) INTO goodies_count
  FROM public.event_activity_logs
  WHERE action_type = 'goodies';

  SELECT COUNT(*) INTO lunch_count
  FROM public.event_activity_logs
  WHERE action_type = 'lunch';

  SELECT COUNT(*) INTO snacks_count
  FROM public.event_activity_logs
  WHERE action_type = 'snacks';

  SELECT COUNT(*) INTO certificates_count
  FROM public.event_activity_logs
  WHERE action_type = 'certificates';

  SELECT COUNT(*) INTO other_count
  FROM public.event_activity_logs
  WHERE action_type NOT IN ('registration', 'goodies', 'lunch', 'snacks', 'certificates');

  SELECT COUNT(*) INTO total_eal
  FROM public.event_activity_logs;

  -- --------------------------------------------------------------------------
  -- 2. Count OPS-related audit_logs entries BEFORE deletion
  --    OPS scan entries use action prefixes: OPS_SCAN_, OPS_SCAN_TEAM_
  --    Revert entries use: REVERT_SCAN_ACTIVITY
  -- --------------------------------------------------------------------------
  SELECT COUNT(*) INTO ops_scan_count
  FROM public.audit_logs
  WHERE action ILIKE 'OPS_SCAN_%';

  SELECT COUNT(*) INTO revert_count
  FROM public.audit_logs
  WHERE action = 'REVERT_SCAN_ACTIVITY';

  SELECT COUNT(*) INTO total_al
  FROM public.audit_logs
  WHERE action ILIKE 'OPS_SCAN_%' OR action = 'REVERT_SCAN_ACTIVITY';

  -- --------------------------------------------------------------------------
  -- 3. Delete all event_activity_logs records (complete OPS scanning history)
  -- --------------------------------------------------------------------------
  DELETE FROM public.event_activity_logs;

  -- --------------------------------------------------------------------------
  -- 4. Delete OPS-related audit_logs entries only
  --    Preserves all non-OPS administrative audit records
  -- --------------------------------------------------------------------------
  DELETE FROM public.audit_logs
  WHERE action ILIKE 'OPS_SCAN_%' OR action = 'REVERT_SCAN_ACTIVITY';

  -- --------------------------------------------------------------------------
  -- 5. Reset team scanning counters (qr_token, last_scanned_at, last_scanned_by)
  -- --------------------------------------------------------------------------
  UPDATE public.teams
  SET qr_token = NULL,
      last_scanned_at = NULL,
      last_scanned_by = NULL;

  GET DIAGNOSTICS teams_reset = ROW_COUNT;

  -- --------------------------------------------------------------------------
  -- 6. Report results via RAISE NOTICE (visible in migration execution logs)
  -- --------------------------------------------------------------------------
  RAISE NOTICE '==============================================================================';
  RAISE NOTICE 'OPS SCANNING HISTORY RESET - RESULTS';
  RAISE NOTICE '==============================================================================';
  RAISE NOTICE 'event_activity_logs deleted:';
  RAISE NOTICE '  registration: %', reg_count;
  RAISE NOTICE '  goodies:      %', goodies_count;
  RAISE NOTICE '  lunch:        %', lunch_count;
  RAISE NOTICE '  snacks:       %', snacks_count;
  RAISE NOTICE '  certificates: %', certificates_count;
  RAISE NOTICE '  other:        %', other_count;
  RAISE NOTICE '  TOTAL:        %', total_eal;
  RAISE NOTICE '';
  RAISE NOTICE 'audit_logs deleted (OPS scan entries only):';
  RAISE NOTICE '  OPS_SCAN_*:   %', ops_scan_count;
  RAISE NOTICE '  REVERT_SCAN_ACTIVITY: %', revert_count;
  RAISE NOTICE '  TOTAL:        %', total_al;
  RAISE NOTICE '';
  RAISE NOTICE 'teams reset (qr_token, last_scanned_at, last_scanned_by): %', teams_reset;
  RAISE NOTICE '==============================================================================';
  RAISE NOTICE 'One-time reset complete. Future scanning remains enabled.';
  RAISE NOTICE '==============================================================================';
END $$;

-- End of migration