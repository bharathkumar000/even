-- ==============================================================================
-- 025_round_management_enhancements.sql
-- Round Management & Active Rounds: Extended round fields, deliverables, scheduling, visibility
--
-- Extends evaluation_rounds with scheduling, visibility, description, objective,
-- instructions, round_type, and related configuration fields.
-- Creates round_deliverables table for required deliverables per round.
-- ==============================================================================

-- ------------------------------------------------------------
-- 1. EXTEND evaluation_rounds TABLE
-- ------------------------------------------------------------

DO $$ BEGIN
    ALTER TABLE public.evaluation_rounds
        ADD COLUMN IF NOT EXISTS description TEXT;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.evaluation_rounds
        ADD COLUMN IF NOT EXISTS objective TEXT;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.evaluation_rounds
        ADD COLUMN IF NOT EXISTS instructions TEXT;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.evaluation_rounds
        ADD COLUMN IF NOT EXISTS round_type TEXT NOT NULL DEFAULT 'standard'
            CHECK (round_type IN ('standard', 'final', 'qualifier', 'custom'));
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.evaluation_rounds
        ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'published'
            CHECK (visibility IN ('published', 'hidden', 'archived'));
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.evaluation_rounds
        ADD COLUMN IF NOT EXISTS view_available_at TIMESTAMPTZ;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.evaluation_rounds
        ADD COLUMN IF NOT EXISTS submission_open_at TIMESTAMPTZ;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.evaluation_rounds
        ADD COLUMN IF NOT EXISTS submission_close_at TIMESTAMPTZ;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.evaluation_rounds
        ADD COLUMN IF NOT EXISTS evaluation_start_at TIMESTAMPTZ;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.evaluation_rounds
        ADD COLUMN IF NOT EXISTS evaluation_end_at TIMESTAMPTZ;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.evaluation_rounds
        ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata';
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.evaluation_rounds
        ADD COLUMN IF NOT EXISTS show_to_teams BOOLEAN NOT NULL DEFAULT true;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.evaluation_rounds
        ADD COLUMN IF NOT EXISTS allow_early_view BOOLEAN NOT NULL DEFAULT false;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_evaluation_rounds_visibility ON public.evaluation_rounds (visibility);
CREATE INDEX IF NOT EXISTS idx_evaluation_rounds_show_to_teams ON public.evaluation_rounds (show_to_teams);
CREATE INDEX IF NOT EXISTS idx_evaluation_rounds_submission_open_at ON public.evaluation_rounds (submission_open_at);
CREATE INDEX IF NOT EXISTS idx_evaluation_rounds_submission_close_at ON public.evaluation_rounds (submission_close_at);

-- ------------------------------------------------------------
-- 2. ROUND DELIVERABLES TABLE
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.round_deliverables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id UUID NOT NULL REFERENCES public.evaluation_rounds(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    is_required BOOLEAN NOT NULL DEFAULT true,
    accepted_formats TEXT[] DEFAULT ARRAY[]::TEXT[],
    max_file_size BIGINT, -- in bytes
    submission_instructions TEXT,
    reference_documents JSONB DEFAULT '[]'::jsonb,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_round_deliverables_round_id ON public.round_deliverables (round_id);
CREATE INDEX IF NOT EXISTS idx_round_deliverables_sort_order ON public.round_deliverables (sort_order);

-- ------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- ------------------------------------------------------------

ALTER TABLE public.round_deliverables ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'round_deliverables' AND policyname = 'Admins can manage round deliverables'
    ) THEN
        CREATE POLICY "Admins can manage round deliverables"
            ON public.round_deliverables FOR ALL
            TO authenticated
            USING (public.is_admin())
            WITH CHECK (public.is_admin());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'round_deliverables' AND policyname = 'Teams can view deliverables of visible rounds'
    ) THEN
        CREATE POLICY "Teams can view deliverables of visible rounds"
            ON public.round_deliverables FOR SELECT
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.evaluation_rounds er
                    WHERE er.id = round_deliverables.round_id
                    AND er.visibility = 'published'
                    AND er.show_to_teams = true
                )
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'round_deliverables' AND policyname = 'Team members can view own team round deliverables'
    ) THEN
        CREATE POLICY "Team members can view own team round deliverables"
            ON public.round_deliverables FOR SELECT
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.evaluation_rounds er
                    WHERE er.id = round_deliverables.round_id
                    AND er.visibility = 'published'
                    AND er.show_to_teams = true
                    AND er.event_id = (
                        SELECT t.event_id FROM public.teams t
                        JOIN public.team_members tm ON tm.team_id = t.id
                        WHERE tm.user_id = auth.uid()
                        LIMIT 1
                    )
                )
            );
    END IF;
END $$;

-- ------------------------------------------------------------
-- 4. GRANT PERMISSIONS
-- ------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON public.round_deliverables TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ------------------------------------------------------------
-- 5. UPDATE evaluation_rounds RLS for new visibility columns
-- ------------------------------------------------------------

-- The existing policies already allow authenticated users to view rounds.
-- We need to ensure teams only see published + visible rounds.
-- Existing policies remain for admin management.
-- The new visibility columns are evaluated in the application layer and via
-- the round_deliverables policies above.

-- End of migration