-- ==============================================================================
-- 016_activity_timer.sql
-- Activity-level timer fields for sync between Admin and Team portals
-- ==============================================================================

-- Add timer fields to problem_statements (used for activities via __hub_activity marker)
DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS timer_end_time TIMESTAMPTZ;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS timer_auto_publish BOOLEAN NOT NULL DEFAULT true;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS timer_timezone VARCHAR(50) NOT NULL DEFAULT 'UTC';
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

-- Add index for timer queries
CREATE INDEX IF NOT EXISTS idx_ps_timer_end_time ON public.problem_statements (timer_end_time);

-- Update RLS policies to allow team users to read timer fields
-- Team users can read timer_end_time, timer_auto_publish, timer_timezone for published activities
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'problem_statements'
          AND policyname = 'Team users can view activity timer'
    ) THEN
        CREATE POLICY "Team users can view activity timer"
            ON public.problem_statements
            FOR SELECT TO authenticated
            USING (
                status = 'published'
                AND (resource_links->'__hub_activity' IS NOT NULL)
            );
    END IF;
END $$;