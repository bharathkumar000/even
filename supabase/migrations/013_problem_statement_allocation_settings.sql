-- ==============================================================================
-- 013_problem_statement_allocation_settings.sql
-- Adds allocation control columns to problem statements.
-- ==============================================================================

-- Enable team selection toggle (default true)
DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS enable_selection BOOLEAN NOT NULL DEFAULT true;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

-- Manual lock toggle (default false)
DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS manual_lock BOOLEAN NOT NULL DEFAULT false;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

-- Optional selection opening and closing timestamps (nullable)
DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS selection_opening TIMESTAMPTZ;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS selection_closing TIMESTAMPTZ;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;
