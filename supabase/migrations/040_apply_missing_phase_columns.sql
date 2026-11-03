-- ==============================================================================
-- 040_apply_missing_phase_columns.sql
-- Apply all missing columns for the two-phase Reading -> Selection workflow.
-- This migration consolidates columns from migrations 038, 039 (both variants)
-- that may not have been applied to the database yet.
-- Idempotent: uses ADD COLUMN IF NOT EXISTS, safe to re-run.
-- ==============================================================================

-- ----------------------------------------------------------------------------
-- 1. SIH-specific columns (from migration 038)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS sih_ps_number TEXT UNIQUE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS organization TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS theme TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS category TEXT CHECK (category IN ('Software', 'Hardware'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS department TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS internal_reference TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS sih_year INT DEFAULT 2025;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Reading phase tracking columns (from migration 039_problem_statement_phase_tracking.sql)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS reading_started_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS reading_ended_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS selection_activated_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS selection_activated_by UUID
            REFERENCES public.profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Team-facing visibility & selection columns (from migration 039_complete_sih_schema.sql)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 4. Indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ps_sih_ps_number ON public.problem_statements (sih_ps_number);
CREATE INDEX IF NOT EXISTS idx_ps_department ON public.problem_statements (department);
CREATE INDEX IF NOT EXISTS idx_ps_category ON public.problem_statements (category);
CREATE INDEX IF NOT EXISTS idx_ps_sih_year ON public.problem_statements (sih_year);
CREATE INDEX IF NOT EXISTS idx_ps_organization ON public.problem_statements (organization);
CREATE INDEX IF NOT EXISTS idx_ps_internal_reference ON public.problem_statements (internal_reference);
CREATE INDEX IF NOT EXISTS idx_ps_reading_started_at ON public.problem_statements (reading_started_at);
CREATE INDEX IF NOT EXISTS idx_ps_selection_activated_at ON public.problem_statements (selection_activated_at);
CREATE INDEX IF NOT EXISTS idx_ps_selection_status ON public.problem_statements (enable_selection, manual_lock);
CREATE INDEX IF NOT EXISTS idx_ps_is_visible_to_teams ON public.problem_statements (is_visible_to_teams);
CREATE INDEX IF NOT EXISTS idx_ps_selection_enabled ON public.problem_statements (selection_enabled);
CREATE INDEX IF NOT EXISTS idx_ps_source_document ON public.problem_statements (source_document);

-- ----------------------------------------------------------------------------
-- 5. Grants
-- ----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.problem_statements TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ==============================================================================
-- End of migration
-- ==============================================================================
