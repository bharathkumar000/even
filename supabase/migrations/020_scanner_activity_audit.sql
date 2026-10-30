-- ==============================================================================
-- IVC EVENTRA / PULSE: Scanner Live Activity Audit Extension
-- Migration: 020_scanner_activity_audit.sql
--
-- Purpose:
--   Extend the existing public.event_activity_logs table (the single source of
--   truth for scanner/distribution activity) so it can record the full audit
--   trail required by the Live Activity Audit Window:
--     * scan attempts (QR + manual), verification success/failure
--     * check-ins and distributions (goodies, lunch, snacks, certificates)
--     * duplicate / already-completed attempts
--     * corrections and reversals with previous/new status
--     * safe failure reasons, method (qr/manual), operator identity snapshot
--   No second competing audit system is created. event_activity_logs remains
--   the authoritative table; this migration only adds columns, indexes and
--   idempotency, and relaxes FK delete behaviour so history is preserved.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ADD 'certificates' TO THE action_type ENUM (idempotent)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'action_type' AND e.enumlabel = 'certificates'
  ) THEN
    ALTER TYPE public.action_type ADD VALUE 'certificates';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'action_type' AND e.enumlabel = 'scan_attempt'
  ) THEN
    ALTER TYPE public.action_type ADD VALUE 'scan_attempt';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'action_type' AND e.enumlabel = 'verification_success'
  ) THEN
    ALTER TYPE public.action_type ADD VALUE 'verification_success';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'action_type' AND e.enumlabel = 'verification_failed'
  ) THEN
    ALTER TYPE public.action_type ADD VALUE 'verification_failed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'action_type' AND e.enumlabel = 'correction'
  ) THEN
    ALTER TYPE public.action_type ADD VALUE 'correction';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'action_type' AND e.enumlabel = 'reversal'
  ) THEN
    ALTER TYPE public.action_type ADD VALUE 'reversal';
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. RELAX FOREIGN-KEY DELETE BEHAVIOUR SO AUDIT HISTORY IS PRESERVED
--    (team_id / participant_id become nullable; ON DELETE SET NULL instead of
--    CASCADE so removing a team or operator never destroys audit records)
-- ------------------------------------------------------------------------------
ALTER TABLE public.event_activity_logs
  DROP CONSTRAINT IF EXISTS event_activity_logs_team_id_fkey;

ALTER TABLE public.event_activity_logs
  DROP CONSTRAINT IF EXISTS event_activity_logs_participant_id_fkey;

ALTER TABLE public.event_activity_logs
  ALTER COLUMN team_id DROP NOT NULL;

ALTER TABLE public.event_activity_logs
  ALTER COLUMN participant_id DROP NOT NULL;

ALTER TABLE public.event_activity_logs
  ADD CONSTRAINT event_activity_logs_team_id_fkey
    FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;

ALTER TABLE public.event_activity_logs
  ADD CONSTRAINT event_activity_logs_participant_id_fkey
    FOREIGN KEY (participant_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ------------------------------------------------------------------------------
-- 3. ADD AUDIT COLUMNS (additive; existing columns untouched)
-- ------------------------------------------------------------------------------
ALTER TABLE public.event_activity_logs
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;

ALTER TABLE public.event_activity_logs
  ADD COLUMN IF NOT EXISTS method TEXT
    CHECK (method IN ('qr', 'manual'));

ALTER TABLE public.event_activity_logs
  ADD COLUMN IF NOT EXISTS result TEXT
    CHECK (result IN ('success', 'failure', 'rejected', 'already_completed'));

ALTER TABLE public.event_activity_logs
  ADD COLUMN IF NOT EXISTS reason TEXT;

ALTER TABLE public.event_activity_logs
  ADD COLUMN IF NOT EXISTS previous_status TEXT;

ALTER TABLE public.event_activity_logs
  ADD COLUMN IF NOT EXISTS new_status TEXT;

ALTER TABLE public.event_activity_logs
  ADD COLUMN IF NOT EXISTS item_name TEXT;

ALTER TABLE public.event_activity_logs
  ADD COLUMN IF NOT EXISTS correlation_id UUID;

ALTER TABLE public.event_activity_logs
  ADD COLUMN IF NOT EXISTS reference_id UUID;

-- Immutable operator identity snapshot (survives profile deletion)
ALTER TABLE public.event_activity_logs
  ADD COLUMN IF NOT EXISTS operator_id UUID;

ALTER TABLE public.event_activity_logs
  ADD COLUMN IF NOT EXISTS operator_name TEXT;

ALTER TABLE public.event_activity_logs
  ADD COLUMN IF NOT EXISTS operator_role TEXT;

-- ------------------------------------------------------------------------------
-- 4. IDENTITY / IDEMPOTENCY
--    Replace the old (participant_id, action_type) uniqueness with a
--    correlation_id unique constraint (idempotency key for retries), plus a
--    partial unique index that preserves the "one successful claim per
--    participant per action" rule only for successful records.
-- ------------------------------------------------------------------------------
DROP INDEX IF EXISTS public.uq_participant_action;
ALTER TABLE public.event_activity_logs
  DROP CONSTRAINT IF EXISTS uq_participant_action;

ALTER TABLE public.event_activity_logs
  ADD CONSTRAINT uq_scanner_activity_correlation UNIQUE (correlation_id)
  WHERE correlation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_scanner_successful_claim
  ON public.event_activity_logs (participant_id, action_type)
  WHERE participant_id IS NOT NULL AND result = 'success';

-- ------------------------------------------------------------------------------
-- 5. INDEXES FOR EFFICIENT FILTERING (Live Activity dashboard)
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_scanner_activity_created_at
  ON public.event_activity_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scanner_activity_team_id
  ON public.event_activity_logs (team_id) WHERE team_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scanner_activity_operator_id
  ON public.event_activity_logs (operator_id) WHERE operator_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scanner_activity_action_type
  ON public.event_activity_logs (action_type);

CREATE INDEX IF NOT EXISTS idx_scanner_activity_result
  ON public.event_activity_logs (result);

CREATE INDEX IF NOT EXISTS idx_scanner_activity_method
  ON public.event_activity_logs (method);

CREATE INDEX IF NOT EXISTS idx_scanner_activity_event_id
  ON public.event_activity_logs (event_id) WHERE event_id IS NOT NULL;

-- Composite index for the most common dashboard query: newest first, filtered by result/action.
CREATE INDEX IF NOT EXISTS idx_scanner_activity_created_result_action
  ON public.event_activity_logs (created_at DESC, result, action_type);

-- ------------------------------------------------------------------------------
-- 6. COMMENTS (documentation for operators)
-- ------------------------------------------------------------------------------
COMMENT ON TABLE public.event_activity_logs IS
  'Scanner and distribution activity audit log. One row per scan attempt, '
  'verification, check-in, distribution, correction or reversal. result column '
  'distinguishes success / failure / rejected / already_completed. '
  'correlation_id provides idempotency for retries.';

COMMENT ON COLUMN public.event_activity_logs.method IS
  'qr = badge QR scan, manual = Team ID lookup';

COMMENT ON COLUMN public.event_activity_logs.result IS
  'success | failure | rejected | already_completed';

COMMENT ON COLUMN public.event_activity_logs.correlation_id IS
  'Idempotency key; duplicate retries with the same correlation_id are ignored.';

COMMENT ON COLUMN public.event_activity_logs.operator_name IS
  'Immutable snapshot of operator display name at time of action.';
COMMENT ON COLUMN public.event_activity_logs.operator_role IS
  'Immutable snapshot of operator role at time of action.';

-- ------------------------------------------------------------------------------
-- 7. REALTIME PUBLICATION (event_activity_logs already added in migration 006;
--    ensure replica identity is full so live payloads include old row data)
-- ------------------------------------------------------------------------------
ALTER TABLE public.event_activity_logs REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'event_activity_logs'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.event_activity_logs;
    END IF;
  END IF;
END $$;
