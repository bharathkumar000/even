-- ==============================================================================
-- Migration: 044_team_registration_credentials.sql
-- Description: Add explicit credential columns to public.team_registrations
--              (login_username, login_email, login_password, team_code)
--              to ensure credentials are fully persisted and readable in Supabase.
-- ==============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'team_registrations' 
          AND column_name = 'login_username'
    ) THEN
        ALTER TABLE public.team_registrations ADD COLUMN login_username TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'team_registrations' 
          AND column_name = 'login_email'
    ) THEN
        ALTER TABLE public.team_registrations ADD COLUMN login_email TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'team_registrations' 
          AND column_name = 'login_password'
    ) THEN
        ALTER TABLE public.team_registrations ADD COLUMN login_password TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'team_registrations' 
          AND column_name = 'team_code'
    ) THEN
        ALTER TABLE public.team_registrations ADD COLUMN team_code TEXT;
    END IF;
END $$;

-- Also ensure teams table has leader_email for direct lookups
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'teams' 
          AND column_name = 'leader_email'
    ) THEN
        ALTER TABLE public.teams ADD COLUMN leader_email TEXT;
    END IF;
END $$;

-- Populate login_email from leader_email where NULL
UPDATE public.team_registrations
SET login_email = lower(trim(leader_email))
WHERE login_email IS NULL;

-- Index for speedy login resolution by username or email
CREATE INDEX IF NOT EXISTS idx_team_reg_login_username ON public.team_registrations(lower(login_username));
CREATE INDEX IF NOT EXISTS idx_team_reg_login_email ON public.team_registrations(lower(login_email));
CREATE INDEX IF NOT EXISTS idx_team_reg_team_code ON public.team_registrations(team_code);

