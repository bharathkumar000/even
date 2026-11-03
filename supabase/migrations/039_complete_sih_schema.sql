-- ==============================================================================
-- 039_complete_sih_schema.sql
-- Adds remaining columns referenced by the SIH importer to match the
-- expected schema. Idempotent - safe to run multiple times.
-- ==============================================================================

-- 1. Additional SIH metadata columns
DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS source_document TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS draft_content JSONB DEFAULT '{}'::jsonb;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS published_content JSONB DEFAULT '{}'::jsonb;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 2. Team-facing visibility & selection columns (use existing where possible, add aliases)
DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS is_visible_to_teams BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS selection_enabled BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS manually_locked BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS selection_open_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS selection_close_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS publication_timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS max_teams INT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 3. Ensure unique constraint on reference_number (already exists from base migration)
-- and sih_ps_number (added in 038)

-- 4. Sync columns: keep enable_selection = selection_enabled, manual_lock = manually_locked,
-- selection_opening = selection_open_at, selection_closing = selection_close_at
-- team_limit = max_teams

-- 5. Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_ps_is_visible_to_teams ON public.problem_statements (is_visible_to_teams);
CREATE INDEX IF NOT EXISTS idx_ps_selection_enabled ON public.problem_statements (selection_enabled);
CREATE INDEX IF NOT EXISTS idx_ps_source_document ON public.problem_statements (source_document);

-- 6. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.problem_statements TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ==============================================================================
-- End of migration
-- ==============================================================================