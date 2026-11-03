-- ==============================================================================
-- IVC PULSE: Timer Mode and Phase Expiry Support
-- Migration: 041_timer_mode_and_phase_expiry.sql
--
-- Purpose:
--   Add a mode column to content_scheduled_publications so the server-side
--   expiry processor knows whether a scheduled timer is for "reading" or
--   "selection" phase activation. This enables server-side timer expiry
--   that does not depend on an admin keeping the browser open.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Add mode column to content_scheduled_publications (idempotent)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'content_scheduled_publications'
      AND column_name = 'mode'
  ) THEN
    ALTER TABLE public.content_scheduled_publications
      ADD COLUMN mode VARCHAR(20) NOT NULL DEFAULT 'reading'
        CHECK (mode IN ('reading', 'selection'));
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. Index for expiry lookup by mode and scheduled time
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_schedules_mode_scheduled_at
  ON public.content_scheduled_publications (mode, scheduled_at)
  WHERE status = 'pending';

-- ------------------------------------------------------------------------------
-- 3. Comments
-- ------------------------------------------------------------------------------
COMMENT ON COLUMN public.content_scheduled_publications.mode IS
  'Timer mode: reading = activate reading phase on expiry, selection = activate selection phase on expiry.';

-- End of migration
