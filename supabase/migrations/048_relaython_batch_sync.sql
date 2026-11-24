-- ==============================================================================
-- IVC PULSE / EVENTRA: Relaython Batch Sync Storage
-- Migration: 048_relaython_batch_sync.sql
--
-- Purpose:
--   1. Create public.relaython_sync_log for batch synchronization of offline
--      Relaython scan records from SPOC devices.
--   2. Use scan_id as idempotency key — repeated uploads of the same scan_id
--      must not create duplicate attendance entries.
--   3. Non-destructive: preserves all existing tables and data.
--   4. Additive: does not depend on relaython_record_checkin RPC (which may
--      not exist if migration 047 is unverified). Uses direct INSERT with
--      ON CONFLICT for idempotency.
--
-- The batch-sync backend endpoint writes to this table. The RPC (if available)
-- can be used alternatively for enforcement, but direct table access ensures
-- the sync path works regardless of RPC availability.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Relaython sync log table (server-side storage for synced offline scans)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.relaython_sync_log (
  scan_id UUID PRIMARY KEY,
  team_code TEXT NOT NULL,
  qr_token_ref TEXT NOT NULL,
  action_type TEXT NOT NULL
    CHECK (action_type IN ('registration', 'snacks_1', 'lunch', 'snacks_2')),
  operator_id UUID NOT NULL,
  operator_name TEXT NOT NULL,
  device_id TEXT NOT NULL,
  scanned_at TIMESTAMPTZ NOT NULL,
  local_sequence_number INTEGER NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'synced'
    CHECK (sync_status IN ('synced', 'rejected')),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_device TEXT NOT NULL DEFAULT 'offline_scanner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_relaython_sync_team_code
  ON public.relaython_sync_log (team_code);

CREATE INDEX IF NOT EXISTS idx_relaython_sync_action_type
  ON public.relaython_sync_log (action_type);

CREATE INDEX IF NOT EXISTS idx_relaython_sync_scanned_at
  ON public.relaython_sync_log (scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_relaython_sync_device_id
  ON public.relaython_sync_log (device_id);

CREATE INDEX IF NOT EXISTS idx_relaython_sync_team_action
  ON public.relaython_sync_log (team_code, action_type);

COMMENT ON TABLE public.relaython_sync_log IS
  'Server-side batch sync storage for offline Relaython scan records. '
  'scan_id is the idempotency key; repeated uploads are ignored.';

-- ------------------------------------------------------------------------------
-- 2. Row Level Security
--    Authenticated users can read; service-role backend writes.
-- ------------------------------------------------------------------------------
ALTER TABLE public.relaython_sync_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'relaython_sync_log'
      AND policyname = 'Authenticated users can read relaython sync log'
  ) THEN
    CREATE POLICY "Authenticated users can read relaython sync log"
      ON public.relaython_sync_log
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. Realtime publication (optional, for Live Activity Stream)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'relaython_sync_log'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.relaython_sync_log;
    END IF;
  END IF;
END $$;

ALTER TABLE public.relaython_sync_log REPLICA IDENTITY FULL;

-- ------------------------------------------------------------------------------
-- 4. Comments
-- ------------------------------------------------------------------------------
COMMENT ON COLUMN public.relaython_sync_log.scan_id IS
  'Client-generated UUID idempotency key. Repeated uploads of same scan_id ignored.';
COMMENT ON COLUMN public.relaython_sync_log.qr_token_ref IS
  'Last 8 characters of qr_token only — never the full token.';

-- End of migration
