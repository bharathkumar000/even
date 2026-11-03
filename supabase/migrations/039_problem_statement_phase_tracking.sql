-- ==============================================================================
-- 039_problem_statement_phase_tracking.sql
-- Add explicit phase tracking columns to problem_statements for the
-- two-stage Reading -> Selection workflow.
-- Idempotent: safe to re-run on existing databases.
-- ==============================================================================

-- 1. Reading phase tracking columns
DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS reading_started_at TIMESTAMPTZ;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS reading_ended_at TIMESTAMPTZ;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

-- 2. Selection phase tracking columns
DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS selection_activated_at TIMESTAMPTZ;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS selection_activated_by UUID
            REFERENCES public.profiles(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

-- 3. Indexes for phase status queries
CREATE INDEX IF NOT EXISTS idx_ps_reading_started_at
    ON public.problem_statements (reading_started_at);

CREATE INDEX IF NOT EXISTS idx_ps_selection_activated_at
    ON public.problem_statements (selection_activated_at);

CREATE INDEX IF NOT EXISTS idx_ps_selection_status
    ON public.problem_statements (enable_selection, manual_lock);

-- 4. Grants (RLS already covers problem_statements via existing policies)
GRANT SELECT, UPDATE(reading_started_at, reading_ended_at, selection_activated_at, selection_activated_by)
    ON public.problem_statements TO authenticated;

-- End of migration
