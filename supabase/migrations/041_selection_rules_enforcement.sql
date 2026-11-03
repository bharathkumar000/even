-- ==============================================================================
-- 041_selection_rules_enforcement.sql
-- Enforces: (1) One PS per team, (2) Max 2 teams per PS (default)
-- Updates default team_limit to 2 and strengthens the capacity trigger.
-- ==============================================================================

-- 1. Set default team_limit to 2 for new problem statements
DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ALTER COLUMN team_limit SET DEFAULT 2;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

-- 2. Sync max_teams and team_limit (keep them consistent)
DO $$ BEGIN
    ALTER TABLE public.problem_statements
        ADD COLUMN IF NOT EXISTS max_teams INT DEFAULT 2;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

-- Sync existing values: prefer team_limit if set, otherwise max_teams, otherwise default 2
UPDATE public.problem_statements
SET team_limit = COALESCE(team_limit, max_teams, 2),
    max_teams = COALESCE(team_limit, max_teams, 2)
WHERE team_limit IS NULL OR max_teams IS NULL;

-- 3. Ensure unique constraint on team_id exists (one PS per team)
-- This already exists from migration 012, but let's verify
DO $$ BEGIN
    ALTER TABLE public.team_problem_statement_assignments
        ADD CONSTRAINT uq_team UNIQUE (team_id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 4. Add index for faster lookups on team_id
CREATE INDEX IF NOT EXISTS idx_ps_assignments_team ON public.team_problem_statement_assignments (team_id);

-- 5. Replace the capacity trigger with a more robust version that:
--    - Uses FOR UPDATE to prevent race conditions
--    - Handles both team_limit and max_teams columns
--    - Provides clear error messages
--    - Runs BEFORE INSERT OR UPDATE
DROP TRIGGER IF EXISTS trg_check_capacity ON public.team_problem_statement_assignments;

CREATE OR REPLACE FUNCTION public.check_problem_statement_capacity()
RETURNS TRIGGER AS $$
DECLARE
    limit_int INT;
    current_count INT;
    team_existing_ps UUID;
BEGIN
    -- RULE 1: Enforce one PS per team (unique constraint on team_id handles this at DB level)
    -- But we check here to provide a clearer error message
    SELECT problem_statement_id INTO team_existing_ps
    FROM public.team_problem_statement_assignments
    WHERE team_id = NEW.team_id
      AND problem_statement_id <> NEW.problem_statement_id
    FOR SHARE;

    IF team_existing_ps IS NOT NULL THEN
        RAISE EXCEPTION 'Team has already selected a different problem statement (Rule: one PS per team).'
            USING ERRCODE = 'P0001';
    END IF;

    -- RULE 2: Enforce capacity limit per problem statement
    -- Lock the problem statement row to prevent concurrent capacity violations
    SELECT COALESCE(team_limit, max_teams, 2) INTO limit_int
    FROM public.problem_statements
    WHERE id = NEW.problem_statement_id
    FOR UPDATE;

    IF limit_int IS NOT NULL THEN
        -- Count existing assignments for this PS, excluding the current team (in case of update)
        SELECT COUNT(*) INTO current_count
        FROM public.team_problem_statement_assignments
        WHERE problem_statement_id = NEW.problem_statement_id
          AND team_id <> NEW.team_id;

        IF current_count >= limit_int THEN
            RAISE EXCEPTION 'Problem statement capacity reached (limit % teams).', limit_int
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_check_capacity
BEFORE INSERT OR UPDATE ON public.team_problem_statement_assignments
FOR EACH ROW EXECUTE FUNCTION public.check_problem_statement_capacity();

-- 6. Grant execute on the function to authenticated users
GRANT EXECUTE ON FUNCTION public.check_problem_statement_capacity() TO authenticated;

-- End of migration