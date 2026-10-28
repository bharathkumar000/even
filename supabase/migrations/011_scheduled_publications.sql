-- ==============================================================================
-- 011_scheduled_publications.sql
-- Scheduled publication support for Content & Activity Hub
--
-- Stores publication schedules that the server-side scheduler processes.
-- Each row represents one scheduled publication of a content item.
-- ==============================================================================

-- Create the scheduled publications table if it does not already exist.
CREATE TABLE IF NOT EXISTS public.content_scheduled_publications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The content item to publish (references problem_statements row).
    -- This row must have a __hub_item marker in resource_links.
    item_id UUID NOT NULL
        REFERENCES public.problem_statements(id) ON DELETE CASCADE,

    -- When to publish the item (UTC or the configured timezone).
    scheduled_at TIMESTAMPTZ NOT NULL,

    -- Timezone identifier used to interpret scheduled_at if not UTC.
    -- Common values: 'UTC', 'America/New_York', 'Europe/London', etc.
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',

    -- Execution state machine.
    status VARCHAR(20) NOT NULL
        DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'cancelled', 'failed')),

-- Who created this schedule.
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

-- Timestamps.
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    executed_at TIMESTAMPTZ,

    -- Optional human-readable failure reason.
    failure_reason TEXT
);

-- Only one pending schedule per item; completed/cancelled history is retained.
ALTER TABLE public.content_scheduled_publications
    DROP CONSTRAINT IF EXISTS content_scheduled_publications_item_id_status_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_schedules_pending_item
    ON public.content_scheduled_publications (item_id)
    WHERE status = 'pending';

-- Allow scheduling-related audit actions (the base audit table only
-- permitted create/edit/publish/unpublish/delete).
DO $$
DECLARE
    constraint_row RECORD;
BEGIN
    FOR constraint_row IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.content_release_audit'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%action%'
    LOOP
        EXECUTE format(
            'ALTER TABLE public.content_release_audit DROP CONSTRAINT %I',
            constraint_row.conname
        );
    END LOOP;

    ALTER TABLE public.content_release_audit
        ADD CONSTRAINT content_release_audit_action_check
        CHECK (action IN (
            'created', 'edited', 'published', 'unpublished', 'deleted',
            'scheduled', 'cancelled', 'rescheduled'
        ));
END $$;

-- Indexes for scheduler lookup and cleanup.
CREATE INDEX IF NOT EXISTS idx_schedules_item_id
    ON public.content_scheduled_publications (item_id);

CREATE INDEX IF NOT EXISTS idx_schedules_status
    ON public.content_scheduled_publications (status);

CREATE INDEX IF NOT EXISTS idx_schedules_scheduled_at
    ON public.content_scheduled_publications (scheduled_at);

CREATE INDEX IF NOT EXISTS idx_schedules_created_by
    ON public.content_scheduled_publications (created_by);

-- Enable row level security.
ALTER TABLE public.content_scheduled_publications ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can manage all schedules.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'content_scheduled_publications'
          AND policyname = 'Admins can manage schedules'
    ) THEN
        CREATE POLICY "Admins can manage schedules"
            ON public.content_scheduled_publications
            FOR ALL TO authenticated
            USING (public.is_admin())
            WITH CHECK (public.is_admin());
    END IF;
END $$;

-- Policy: Authenticated users can view pending schedules (for UI display).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'content_scheduled_publications'
          AND policyname = 'Users can view pending schedules'
    ) THEN
        CREATE POLICY "Users can view pending schedules"
            ON public.content_scheduled_publications
            FOR SELECT TO authenticated
            USING (status = 'pending' OR public.is_admin());
    END IF;
END $$;