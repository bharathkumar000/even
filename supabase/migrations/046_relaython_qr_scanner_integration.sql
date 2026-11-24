-- ==============================================================================
-- IVC PULSE / EVENTRA: Relaython QR Scanner Integration
-- Migration: 046_relaython_qr_scanner_integration.sql
--
-- Purpose:
--   1. Ensure public.relaython_qr_registry exists (populated by Relaython
--      Google Apps Script sync; scanner reads this table for token lookup).
--   2. Create public.relaython_activity_logs for Relaython check-in attendance
--      (separate from public.event_activity_logs so legacy Eventra data is
--      never touched, and Relaython teams -- which may not exist in public.teams
--      or public.team_members -- can still be checked in).
--   3. Database-enforced uniqueness on (team_code, action_type) to prevent
--      duplicate check-ins under concurrent scans.
--   4. RLS: authenticated users can read registry + their own activity logs;
--      service-role server actions perform all writes (browser never holds
--      service role key).
--
-- Non-destructive: only ADDitive. No existing tables, columns, or data are
-- altered or deleted.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. relaython_qr_registry (additive; populated externally by Apps Script sync)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.relaython_qr_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_code TEXT NOT NULL,
  team_name TEXT NOT NULL,
  leader_name TEXT NOT NULL,
  domain TEXT NOT NULL,
  qr_token TEXT NOT NULL,
  qr_url TEXT NOT NULL,
  source_spreadsheet_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.relaython_qr_registry
  ADD CONSTRAINT IF NOT EXISTS relaython_qr_registry_team_code_key UNIQUE (team_code);

ALTER TABLE public.relaython_qr_registry
  ADD CONSTRAINT IF NOT EXISTS relaython_qr_registry_qr_token_key UNIQUE (qr_token);

CREATE INDEX IF NOT EXISTS idx_relaython_registry_qr_token
  ON public.relaython_qr_registry (qr_token);

CREATE INDEX IF NOT EXISTS idx_relaython_registry_team_code
  ON public.relaython_qr_registry (team_code);

COMMENT ON TABLE public.relaython_qr_registry IS
  'Relaython QR token registry (populated by Google Apps Script sync). '
  'Scanner performs exact qr_token lookup to recognize Relaython badges.';

-- ------------------------------------------------------------------------------
-- 2. relaython_activity_logs (Relaython check-in attendance, isolated from legacy)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.relaython_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_code TEXT NOT NULL,
  qr_token TEXT NOT NULL,
  action_type TEXT NOT NULL
    CHECK (action_type IN ('registration', 'goodies', 'lunch', 'snacks', 'snacks_1', 'snacks_2', 'certificates')),
  scanned_by TEXT NOT NULL,
  operator_id UUID NOT NULL,
  operator_name TEXT NOT NULL,
  operator_role TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'qr'
    CHECK (method IN ('qr', 'manual')),
  result TEXT NOT NULL DEFAULT 'success'
    CHECK (result IN ('success', 'failure', 'rejected', 'already_completed')),
  correlation_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Database-enforced uniqueness: one successful check-in per team per action type.
-- Prevents duplicate check-ins even under concurrent scanner requests.
CREATE UNIQUE INDEX IF NOT EXISTS uq_relaython_successful_checkin
  ON public.relaython_activity_logs (team_code, action_type)
  WHERE result = 'success';

CREATE INDEX IF NOT EXISTS idx_relaython_activity_team_code
  ON public.relaython_activity_logs (team_code);

CREATE INDEX IF NOT EXISTS idx_relaython_activity_created_at
  ON public.relaython_activity_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_relaython_activity_correlation_id
  ON public.relaython_activity_logs (correlation_id);

COMMENT ON TABLE public.relaython_activity_logs IS
  'Relaython scanner check-in attendance. Isolated from public.event_activity_logs '
  'so legacy Eventra data is never modified. One row per check-in attempt.';

-- ------------------------------------------------------------------------------
-- 3. Row Level Security
--    Reads: authenticated users can view registry and activity logs.
--    Writes: service-role server actions only (bypass RLS); browser never holds
--    the service role key.
-- ------------------------------------------------------------------------------
ALTER TABLE public.relaython_qr_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relaython_activity_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- relaython_qr_registry: authenticated read, service-role write (bypass RLS)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'relaython_qr_registry' AND policyname = 'Authenticated users can read relaython registry'
  ) THEN
    CREATE POLICY "Authenticated users can read relaython registry"
      ON public.relaython_qr_registry
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  -- relaython_activity_logs: authenticated read, service-role write (bypass RLS)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'relaython_activity_logs' AND policyname = 'Authenticated users can read relaython activity logs'
  ) THEN
    CREATE POLICY "Authenticated users can read relaython activity logs"
      ON public.relaython_activity_logs
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4. Realtime publication (so Live Activity Stream can subscribe)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'relaython_activity_logs'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.relaython_activity_logs;
    END IF;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 5. Replica identity (so realtime payloads include prior row data)
-- ------------------------------------------------------------------------------
ALTER TABLE public.relaython_activity_logs REPLICA IDENTITY FULL;
