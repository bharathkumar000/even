-- ==============================================================================
-- 038_sih_problem_statements_import.sql
-- Adds SIH-specific columns to problem_statements table for importing
-- the 30 SIH 2025 problem statements from the case study booklet.
-- ==============================================================================

-- 1. Add SIH-specific columns to problem_statements
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

-- 2. Indexes for SIH-specific queries
CREATE INDEX IF NOT EXISTS idx_ps_sih_ps_number ON public.problem_statements (sih_ps_number);
CREATE INDEX IF NOT EXISTS idx_ps_department ON public.problem_statements (department);
CREATE INDEX IF NOT EXISTS idx_ps_category ON public.problem_statements (category);
CREATE INDEX IF NOT EXISTS idx_ps_sih_year ON public.problem_statements (sih_year);
CREATE INDEX IF NOT EXISTS idx_ps_organization ON public.problem_statements (organization);
CREATE INDEX IF NOT EXISTS idx_ps_internal_reference ON public.problem_statements (internal_reference);

-- 3. Ensure RLS policies cover new columns (existing policies already cover all columns)
-- No additional RLS needed - problem_statements RLS already covers all columns.

-- 4. Grant permissions (already granted in prior migrations, but ensuring here for completeness)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.problem_statements TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ==============================================================================
-- End of migration
-- ==============================================================================