-- ==============================================================================
-- 017_announcements_system.sql
-- Comprehensive Announcements System for EVENTRA / IVC PULSE
-- Extends the existing announcements table with full scheduling, categories,
-- drafts, attachments, pin-to-top, expanded audience targeting, and audit.
-- ==============================================================================

-- 1. Extend announcements table with new columns
DO $$ BEGIN
    ALTER TABLE public.announcements
        ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'
            CHECK (status IN ('draft', 'scheduled', 'published', 'unpublished', 'archived'));
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.announcements
        ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general'
            CHECK (category IN ('general', 'important', 'deadline', 'schedule', 'emergency'));
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.announcements
        ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.announcements
        ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.announcements
        ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.announcements
        ADD COLUMN IF NOT EXISTS pin_to_top BOOLEAN NOT NULL DEFAULT false;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.announcements
        ADD COLUMN IF NOT EXISTS priority_level TEXT NOT NULL DEFAULT 'normal'
            CHECK (priority_level IN ('normal', 'high', 'urgent'));
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.announcements
        ADD COLUMN IF NOT EXISTS attachment_url TEXT;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.announcements
        ADD COLUMN IF NOT EXISTS attachment_name TEXT;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.announcements
        ADD COLUMN IF NOT EXISTS resource_links JSONB DEFAULT '[]'::jsonb;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.announcements
        ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.announcements
        ADD COLUMN IF NOT EXISTS scheduled_job_id UUID;
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

-- 2. Expand target_audience enum to include all portal types
-- Note: We keep it as TEXT with CHECK constraint for flexibility
ALTER TABLE public.announcements
    DROP CONSTRAINT IF EXISTS announcements_target_audience_check;

ALTER TABLE public.announcements
    ADD CONSTRAINT announcements_target_audience_check
    CHECK (target_audience IN (
        'all',
        'teams',
        'judges',
        'ops',
        'admin',
        'participants',
        'staff',
        'organizers'
    ));

-- 3. Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_announcements_status ON public.announcements (status);
CREATE INDEX IF NOT EXISTS idx_announcements_scheduled_at ON public.announcements (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_announcements_published_at ON public.announcements (published_at);
CREATE INDEX IF NOT EXISTS idx_announcements_expires_at ON public.announcements (expires_at);
CREATE INDEX IF NOT EXISTS idx_announcements_target_audience ON public.announcements (target_audience);
CREATE INDEX IF NOT EXISTS idx_announcements_pin_to_top ON public.announcements (pin_to_top);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements (created_at DESC);

-- 4. Updated at trigger
DROP TRIGGER IF EXISTS trg_set_updated_at_announcements ON public.announcements;
CREATE TRIGGER trg_set_updated_at_announcements
    BEFORE UPDATE ON public.announcements
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Enable Realtime (already done in 007, but ensure)
ALTER TABLE public.announcements REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'announcements'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
        END IF;
    END IF;
END $$;

-- 6. Create announcement_schedules table for tracking scheduled jobs
CREATE TABLE IF NOT EXISTS public.announcement_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMPTZ NOT NULL,
    job_type TEXT NOT NULL DEFAULT 'publish' CHECK (job_type IN ('publish', 'expire', 'unpublish')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    error_message TEXT,
    executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.announcement_schedules ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_announcement_schedules_announcement_id ON public.announcement_schedules (announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_schedules_scheduled_at ON public.announcement_schedules (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_announcement_schedules_status ON public.announcement_schedules (status);

DROP TRIGGER IF EXISTS trg_set_updated_at_announcement_schedules ON public.announcement_schedules;
CREATE TRIGGER trg_set_updated_at_announcement_schedules
    BEFORE UPDATE ON public.announcement_schedules
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS Policies for announcement_schedules
CREATE POLICY "Admins can manage announcement schedules"
    ON public.announcement_schedules FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 7. Create announcements_audit table for audit trail
CREATE TABLE IF NOT EXISTS public.announcements_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    previous_data JSONB,
    new_data JSONB,
    performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_audit_announcement_id ON public.announcements_audit (announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcements_audit_created_at ON public.announcements_audit (created_at DESC);

ALTER TABLE public.announcements_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view announcements audit"
    ON public.announcements_audit FOR SELECT
    TO authenticated
    USING (public.is_admin());

-- 8. Create function to write audit log
CREATE OR REPLACE FUNCTION public.write_announcement_audit(
    p_announcement_id UUID,
    p_action TEXT,
    p_previous_data JSONB DEFAULT NULL,
    p_new_data JSONB DEFAULT NULL,
    p_performed_by UUID DEFAULT NULL,
    p_details JSONB DEFAULT '{}'::jsonb
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.announcements_audit (
        announcement_id,
        action,
        previous_data,
        new_data,
        performed_by,
        details
    ) VALUES (
        p_announcement_id,
        p_action,
        p_previous_data,
        p_new_data,
        p_performed_by,
        p_details
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Create function to get announcements for a specific audience (used by portals)
CREATE OR REPLACE FUNCTION public.get_announcements_for_audience(
    p_audience TEXT,
    p_limit INT DEFAULT 50
) RETURNS TABLE (
    id UUID,
    title TEXT,
    message TEXT,
    category TEXT,
    priority_level TEXT,
    target_audience TEXT,
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    pin_to_top BOOLEAN,
    attachment_url TEXT,
    attachment_name TEXT,
    resource_links JSONB,
    created_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.title,
        a.message,
        a.category,
        a.priority_level,
        a.target_audience,
        a.scheduled_at,
        a.published_at,
        a.expires_at,
        a.pin_to_top,
        a.attachment_url,
        a.attachment_name,
        a.resource_links,
        a.created_at,
        a.published_at
    FROM public.announcements a
    WHERE a.status = 'published'
        AND a.is_active = true
        AND (a.expires_at IS NULL OR a.expires_at > now())
        AND (
            a.target_audience = 'all'
            OR a.target_audience = p_audience
            OR p_audience = 'all'
        )
    ORDER BY a.pin_to_top DESC, a.published_at DESC NULLS LAST, a.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Create function to process scheduled announcements (for pg_cron)
CREATE OR REPLACE FUNCTION public.process_scheduled_announcements()
RETURNS VOID AS $$
DECLARE
    v_announcement RECORD;
BEGIN
    -- Process pending publications
    FOR v_announcement IN
        SELECT a.*, s.id as schedule_id
        FROM public.announcements a
        JOIN public.announcement_schedules s ON s.announcement_id = a.id
        WHERE s.status = 'pending'
            AND s.job_type = 'publish'
            AND s.scheduled_at <= now()
    LOOP
        UPDATE public.announcement_schedules
        SET status = 'processing', updated_at = now()
        WHERE id = v_announcement.schedule_id;

        BEGIN
            UPDATE public.announcements
            SET
                status = 'published',
                published_at = now(),
                is_active = true,
                updated_at = now()
            WHERE id = v_announcement.id;

            UPDATE public.announcement_schedules
            SET status = 'completed', executed_at = now(), updated_at = now()
            WHERE id = v_announcement.schedule_id;

            PERFORM public.write_announcement_audit(
                v_announcement.id,
                'published_scheduled',
                jsonb_build_object('status', 'scheduled'),
                jsonb_build_object('status', 'published', 'published_at', now()),
                NULL,
                jsonb_build_object('schedule_id', v_announcement.schedule_id)
            );
        EXCEPTION WHEN OTHERS THEN
            UPDATE public.announcement_schedules
            SET status = 'failed', error_message = SQLERRM, updated_at = now()
            WHERE id = v_announcement.schedule_id;
        END;
    END LOOP;

    -- Process pending expirations
    FOR v_announcement IN
        SELECT a.*, s.id as schedule_id
        FROM public.announcements a
        JOIN public.announcement_schedules s ON s.announcement_id = a.id
        WHERE s.status = 'pending'
            AND s.job_type = 'expire'
            AND s.scheduled_at <= now()
    LOOP
        UPDATE public.announcement_schedules
        SET status = 'processing', updated_at = now()
        WHERE id = v_announcement.schedule_id;

        BEGIN
            UPDATE public.announcements
            SET
                status = 'unpublished',
                is_active = false,
                updated_at = now()
            WHERE id = v_announcement.id;

            UPDATE public.announcement_schedules
            SET status = 'completed', executed_at = now(), updated_at = now()
            WHERE id = v_announcement.schedule_id;

            PERFORM public.write_announcement_audit(
                v_announcement.id,
                'expired',
                jsonb_build_object('status', 'published', 'is_active', true),
                jsonb_build_object('status', 'unpublished', 'is_active', false),
                NULL,
                jsonb_build_object('schedule_id', v_announcement.schedule_id)
            );
        EXCEPTION WHEN OTHERS THEN
            UPDATE public.announcement_schedules
            SET status = 'failed', error_message = SQLERRM, updated_at = now()
            WHERE id = v_announcement.schedule_id;
        END;
    END LOOP;

    -- Process pending unpublish (manual unpublish scheduled)
    FOR v_announcement IN
        SELECT a.*, s.id as schedule_id
        FROM public.announcements a
        JOIN public.announcement_schedules s ON s.announcement_id = a.id
        WHERE s.status = 'pending'
            AND s.job_type = 'unpublish'
            AND s.scheduled_at <= now()
    LOOP
        UPDATE public.announcement_schedules
        SET status = 'processing', updated_at = now()
        WHERE id = v_announcement.schedule_id;

        BEGIN
            UPDATE public.announcements
            SET
                status = 'unpublished',
                is_active = false,
                updated_at = now()
            WHERE id = v_announcement.id;

            UPDATE public.announcement_schedules
            SET status = 'completed', executed_at = now(), updated_at = now()
            WHERE id = v_announcement.schedule_id;

            PERFORM public.write_announcement_audit(
                v_announcement.id,
                'unpublished_scheduled',
                jsonb_build_object('status', 'published', 'is_active', true),
                jsonb_build_object('status', 'unpublished', 'is_active', false),
                NULL,
                jsonb_build_object('schedule_id', v_announcement.schedule_id)
            );
        EXCEPTION WHEN OTHERS THEN
            UPDATE public.announcement_schedules
            SET status = 'failed', error_message = SQLERRM, updated_at = now()
            WHERE id = v_announcement.schedule_id;
        END;
    END LOOP;

    -- Auto-expire published announcements that have passed their expiry time (no schedule needed)
    UPDATE public.announcements
    SET
        status = 'unpublished',
        is_active = false,
        updated_at = now()
    WHERE status = 'published'
        AND is_active = true
        AND expires_at IS NOT NULL
        AND expires_at <= now()
        AND NOT EXISTS (
            SELECT 1 FROM public.announcement_schedules s
            WHERE s.announcement_id = announcements.id
                AND s.job_type = 'expire'
                AND s.status IN ('pending', 'processing')
        );

    -- Auto-expire: log audit for auto-expired
    -- Note: This is a simplified approach; in production you might want to log each
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.process_scheduled_announcements() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_announcements_for_audience(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.write_announcement_audit(UUID, TEXT, JSONB, JSONB, UUID, JSONB) TO authenticated;