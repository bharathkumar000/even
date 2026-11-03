-- ==============================================================================
-- 034_problem_statement_timers_and_bulk_actions.sql
-- Adds server-backed timer support and bulk action infrastructure for problem statements.
--
-- Existing columns (from prior migrations) that this relies on:
--   problem_statements.timer_end_time          - Reading timer end time
--   problem_statements.timer_auto_publish      - Auto-publish when reading timer expires
--   problem_statements.timer_timezone          - Timezone for reading timer
--   problem_statements.enable_selection        - Whether team selection is enabled
--   problem_statements.manual_lock             - Manual lock override
--   problem_statements.selection_opening       - When selection window opens
--   problem_statements.selection_closing       - When selection window closes
--
-- This migration:
--   1. Ensures all timer/selection columns exist (idempotent)
--   2. Adds indexes for timer/selection queries
--   3. Ensures RLS policies cover selection/timer fields
-- ==============================================================================

-- ------------------------------------------------------------
-- 1. Ensure timer columns exist on problem_statements
-- ------------------------------------------------------------
DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS timer_end_time TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS timer_auto_publish BOOLEAN NOT NULL DEFAULT true;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS timer_timezone VARCHAR(50) NOT NULL DEFAULT 'UTC';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ------------------------------------------------------------
-- 2. Ensure selection columns exist on problem_statements
-- ------------------------------------------------------------
DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS enable_selection BOOLEAN NOT NULL DEFAULT true;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS manual_lock BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS selection_opening TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS selection_closing TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ------------------------------------------------------------
-- 3. Indexes for timer/selection queries
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ps_timer_end_time ON public.problem_statements (timer_end_time);
CREATE INDEX IF NOT EXISTS idx_ps_selection_opening ON public.problem_statements (selection_opening);
CREATE INDEX IF NOT EXISTS idx_ps_selection_closing ON public.problem_statements (selection_closing);
CREATE INDEX IF NOT EXISTS idx_ps_enable_selection ON public.problem_statements (enable_selection);
CREATE INDEX IF NOT EXISTS idx_ps_status_selection ON public.problem_statements (status, enable_selection);

-- ------------------------------------------------------------
-- 4. Ensure RLS policies cover selection/timer fields
-- (Existing policies already allow SELECT on status='published';
--  the selection columns are part of the same row, so they're covered.)
-- ------------------------------------------------------------
-- No additional RLS needed - problem_statements RLS already covers all columns.

-- ------------------------------------------------------------
-- 5. Grant permissions (already granted in prior migrations,
--    but ensuring here for completeness)
-- ------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.problem_statements TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ==============================================================================
-- End of migration
-- ==============================================================================
