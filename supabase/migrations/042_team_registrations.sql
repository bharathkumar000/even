-- ==============================================================================
-- Migration: 042_team_registrations.sql
-- Description: Create dedicated team_registrations table for public registration
--              submissions, payment verification, and automated credential generation.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.team_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_name TEXT NOT NULL,
    track TEXT NOT NULL,
    leader_name TEXT NOT NULL,
    leader_email TEXT NOT NULL,
    leader_phone TEXT NOT NULL,
    leader_college TEXT NOT NULL,
    leader_usn TEXT NOT NULL,
    leader_branch TEXT NOT NULL,
    leader_sem TEXT NOT NULL,
    members JSONB NOT NULL DEFAULT '[]'::jsonb,
    payment_utr TEXT NOT NULL,
    payment_phone TEXT NOT NULL,
    payment_proof_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    rejection_reason TEXT,
    generated_credentials JSONB,
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.team_registrations ENABLE ROW LEVEL SECURITY;

-- Allow public anonymous users to insert new registrations
CREATE POLICY "Allow public insert of registrations"
    ON public.team_registrations
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Allow admins and staff to read all registrations
CREATE POLICY "Allow staff and admin to view registrations"
    ON public.team_registrations
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'staff')
        )
    );

-- Allow admins to update registrations (approve/reject)
CREATE POLICY "Allow admin to update registrations"
    ON public.team_registrations
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    )
    WITH CHECK (true);

-- Index for speedy listing by status and date
CREATE INDEX IF NOT EXISTS idx_team_registrations_status ON public.team_registrations(status);
CREATE INDEX IF NOT EXISTS idx_team_registrations_created_at ON public.team_registrations(created_at DESC);
