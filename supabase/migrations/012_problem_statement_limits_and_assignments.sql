-- ==============================================================================
-- 012_problem_statement_limits_and_assignments.sql
-- Adds configurable team limits to problem statements and a table to track
-- team‑to‑statement allocations with capacity enforcement via a trigger.
-- ==============================================================================

-- 1. Add optional team_limit column to problem_statements
DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS team_limit INT;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

-- 2. Create table to store which team has selected which problem statement
CREATE TABLE IF NOT EXISTS public.team_problem_statement_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    problem_statement_id UUID NOT NULL REFERENCES public.problem_statements(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_team UNIQUE (team_id)
);

-- 3. Index for fast lookup of assignments per problem statement
CREATE INDEX IF NOT EXISTS idx_ps_assignments_statement ON public.team_problem_statement_assignments (problem_statement_id);

-- 4. Enable row level security on the new table (admin only)
ALTER TABLE public.team_problem_statement_assignments ENABLE ROW LEVEL SECURITY;

-- 5. Policies – admins can manage, team leaders can read their own assignment.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'team_problem_statement_assignments'
          AND policyname = 'Admins can manage team-statement assignments'
    ) THEN
        CREATE POLICY "Admins can manage team-statement assignments"
            ON public.team_problem_statement_assignments
            FOR ALL TO authenticated
            USING (public.is_admin())
            WITH CHECK (public.is_admin());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'team_problem_statement_assignments'
          AND policyname = 'Team leaders can view own assignment'
    ) THEN
        CREATE POLICY "Team leaders can view own assignment"
            ON public.team_problem_statement_assignments
            FOR SELECT TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.team_members tm
                    WHERE tm.team_id = team_problem_statement_assignments.team_id
                      AND tm.user_id = auth.uid()
                      AND tm.role = 'leader'
                )
            );
    END IF;
END $$;

-- 6. Trigger to enforce team limits atomically
CREATE OR REPLACE FUNCTION public.check_problem_statement_capacity()
RETURNS TRIGGER AS $$
DECLARE
    limit_int INT;
    current_count INT;
BEGIN
    -- Fetch the limit for the target problem statement (FOR UPDATE locks the row)
    SELECT team_limit INTO limit_int FROM public.problem_statements WHERE id = NEW.problem_statement_id FOR UPDATE;

    IF limit_int IS NOT NULL THEN
        -- Count existing assignments excluding the current team's assignment (in case of update)
        SELECT COUNT(*) INTO current_count
        FROM public.team_problem_statement_assignments
        WHERE problem_statement_id = NEW.problem_statement_id
          AND team_id <> NEW.team_id;
        IF current_count >= limit_int THEN
            RAISE EXCEPTION 'Problem statement capacity reached (limit %)', limit_int USING ERRCODE = 'P0001';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_check_capacity ON public.team_problem_statement_assignments;
CREATE TRIGGER trg_check_capacity
BEFORE INSERT OR UPDATE ON public.team_problem_statement_assignments
FOR EACH ROW EXECUTE FUNCTION public.check_problem_statement_capacity();

-- End of migration
