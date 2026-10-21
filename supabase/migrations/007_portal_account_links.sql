-- ==============================================================================
-- IVC PULSE: Portal Account Links Migration
-- Migration: 007_portal_account_links.sql
-- Adds a mapping table between Teams and Supabase Auth users for portal accounts.
-- ==============================================================================

-- 1. Portal Account Links Table
CREATE TABLE IF NOT EXISTS public.portal_account_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_portal_account_links_team_user UNIQUE (team_id, user_id)
);

-- 2. Indexes for fast look‑ups
CREATE INDEX IF NOT EXISTS idx_portal_account_links_team ON public.portal_account_links(team_id);
CREATE INDEX IF NOT EXISTS idx_portal_account_links_user ON public.portal_account_links(user_id);

-- 3. Enable Row Level Security
ALTER TABLE public.portal_account_links ENABLE ROW LEVEL SECURITY;

-- 4. Policies
-- Admins can manage (SELECT, INSERT, UPDATE, DELETE) all rows
DROP POLICY IF EXISTS "Admins can manage portal account links" ON public.portal_account_links;
CREATE POLICY "Admins can manage portal account links"
    ON public.portal_account_links
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Authenticated users (team members) can view links for their own team(s)
DROP POLICY IF EXISTS "Team members can view portal account links" ON public.portal_account_links;
CREATE POLICY "Team members can view portal account links"
    ON public.portal_account_links
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.team_members
            WHERE team_members.team_id = portal_account_links.team_id
              AND team_members.user_id = auth.uid()
        )
    );
