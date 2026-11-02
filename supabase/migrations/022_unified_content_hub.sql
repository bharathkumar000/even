-- ==============================================================================
-- 022_unified_content_hub.sql
-- Unified Content & Activity Hub for all EVENTRA / IVC-PULSE portals
-- Extends the existing content activity hub with proper multi-portal audience targeting
-- ==============================================================================

-- ==============================================================================
-- 1. PORTAL AUDIENCE ENUM AND HELPER FUNCTIONS
-- ==============================================================================

-- Portal audience types (matching the application's portal structure)
DO $$ BEGIN
    CREATE TYPE portal_audience AS ENUM (
        'all',              -- All portals
        'team_leader',      -- Team Leader portal
        'participant',      -- Participant/Team Member portal
        'staff',            -- Staff/SPOC portal
        'judge',            -- Judge portal
        'operations',       -- Operations portal
        'organizer',        -- Organizer portal (if distinct)
        'admin'             -- Admin portal
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Helper function: check if current user has admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
$$;

-- Helper function: check if current user is staff or admin
CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('staff', 'organizer', 'admin')
    );
$$;

-- Helper function: check if current user is a team leader
CREATE OR REPLACE FUNCTION public.is_team_leader()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.user_id = auth.uid() AND tm.role = 'leader'
    );
$$;

-- Helper function: check if current user is a participant
CREATE OR REPLACE FUNCTION public.is_participant()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.user_id = auth.uid() AND tm.role = 'member'
    );
$$;

-- Helper function: check if current user is a judge
CREATE OR REPLACE FUNCTION public.is_judge()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'judge'
    )
    OR EXISTS (
        SELECT 1 FROM public.judge_assignments ja WHERE ja.judge_id = auth.uid()
    );
$$;

-- Helper function: check if current user is operations staff
CREATE OR REPLACE FUNCTION public.is_operations()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('staff', 'organizer')
    );
$$;

-- Helper function: get current user's portal audience
CREATE OR REPLACE FUNCTION public.get_user_portal_audience()
RETURNS portal_audience
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT CASE
        WHEN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN 'admin'::portal_audience
        WHEN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('staff', 'organizer')) THEN 'staff'::portal_audience
        WHEN EXISTS (SELECT 1 FROM public.judge_assignments WHERE judge_id = auth.uid()) THEN 'judge'::portal_audience
        WHEN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('staff', 'organizer')) THEN 'operations'::portal_audience
        WHEN EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.user_id = auth.uid() AND tm.role = 'leader'
        ) THEN 'team_leader'::portal_audience
        WHEN EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.user_id = auth.uid() AND tm.role = 'member'
        ) THEN 'participant'::portal_audience
        ELSE 'participant'::portal_audience
    END;
$$;

-- Helper function: check if user has access to a specific portal audience
CREATE OR REPLACE FUNCTION public.has_portal_access(p_audience portal_audience)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT CASE p_audience
        WHEN 'all' THEN true
        WHEN 'admin' THEN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
        WHEN 'staff' THEN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('staff', 'organizer'))
        WHEN 'operations' THEN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('staff', 'organizer'))
        WHEN 'judge' THEN (
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'judge')
            OR EXISTS (SELECT 1 FROM public.judge_assignments WHERE judge_id = auth.uid())
        )
        WHEN 'staff' THEN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('staff', 'organizer'))
        WHEN 'organizer' THEN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'organizer')
        WHEN 'team_leader' THEN EXISTS (
            SELECT 1 FROM public.team_members tm WHERE tm.user_id = auth.uid() AND tm.role = 'leader'
        )
        WHEN 'participant' THEN EXISTS (
            SELECT 1 FROM public.team_members tm WHERE tm.user_id = auth.uid() AND tm.role = 'member'
        )
        ELSE false
    END;
$$;

-- ==============================================================================
-- 2. UNIFIED CONTENT HUB TABLES
-- ==============================================================================

-- Content types enum
DO $$ BEGIN
    CREATE TYPE content_type AS ENUM (
        'problem_statement',
        'certificate_release',
        'announcement',
        'resource',
        'custom'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Content status enum
DO $$ BEGIN
    CREATE TYPE content_status AS ENUM (
        'draft',
        'scheduled',
        'published',
        'unpublished',
        'archived'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Main content hub table - unified content items for all portals
CREATE TABLE IF NOT EXISTS public.content_hub (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_number TEXT UNIQUE,
    title TEXT NOT NULL,
    summary TEXT,
    body TEXT,
    content_type content_type NOT NULL DEFAULT 'custom',
    category TEXT,
    status content_status NOT NULL DEFAULT 'draft',
    priority_level TEXT NOT NULL DEFAULT 'normal' CHECK (priority_level IN ('normal', 'high', 'urgent')),
    pin_to_top BOOLEAN NOT NULL DEFAULT false,
    
    -- Target audiences (multi-portal support)
    target_audiences portal_audience[] NOT NULL DEFAULT ARRAY['all']::portal_audience[],
    
    -- Legacy single audience for backward compatibility
    target_audience TEXT DEFAULT 'all',
    
    -- Scheduling
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    
    -- Domain-specific metadata (JSONB for flexibility)
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Content-specific fields
    domain TEXT,                    -- For problem statements
    team_limit INT,                 -- For problem statements
    enable_selection BOOLEAN DEFAULT true,
    manual_lock BOOLEAN DEFAULT false,
    selection_opening TIMESTAMPTZ,
    selection_closing TIMESTAMPTZ,
    
    -- Certificate-specific fields
    recipient TEXT,                 -- For certificates
    team_name TEXT,                 -- For certificates
    
    -- Resource-specific fields
    resource_url TEXT,              -- For resources
    
    -- Attachments
    attachment_url TEXT,
    attachment_name TEXT,
    resource_links JSONB DEFAULT '[]'::jsonb,
    
    -- Authorship and audit
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    published_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    
    -- Soft delete
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_content_hub_status ON public.content_hub (status);
CREATE INDEX IF NOT EXISTS idx_content_hub_content_type ON public.content_hub (content_type);
CREATE INDEX IF NOT EXISTS idx_content_hub_target_audiences ON public.content_hub USING GIN (target_audiences);
CREATE INDEX IF NOT EXISTS idx_content_hub_scheduled_at ON public.content_hub (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_content_hub_published_at ON public.content_hub (published_at);
CREATE INDEX IF NOT EXISTS idx_content_hub_expires_at ON public.content_hub (expires_at);
CREATE INDEX IF NOT EXISTS idx_content_hub_created_at ON public.content_hub (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_hub_published_at ON public.content_hub (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_hub_priority ON public.content_hub (priority_level);
CREATE INDEX IF NOT EXISTS idx_content_hub_pin_to_top ON public.content_hub (pin_to_top);

-- Content hub attachments table
CREATE TABLE IF NOT EXISTS public.content_hub_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES public.content_hub(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    mime_type TEXT,
    size BIGINT NOT NULL,
    uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_hub_attachments_content_id ON public.content_hub_attachments (content_id);

-- Content hub audit trail
CREATE TABLE IF NOT EXISTS public.content_hub_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES public.content_hub(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    previous_data JSONB,
    new_data JSONB,
    performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_hub_audit_content_id ON public.content_hub_audit (content_id);
CREATE INDEX IF NOT EXISTS idx_content_hub_audit_created_at ON public.content_hub_audit (created_at DESC);

-- Content hub scheduled publications
CREATE TABLE IF NOT EXISTS public.content_hub_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES public.content_hub(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMPTZ NOT NULL,
    job_type TEXT NOT NULL DEFAULT 'publish' CHECK (job_type IN ('publish', 'expire', 'unpublish')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    error_message TEXT,
    executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.content_hub_schedules ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_content_hub_schedules_content_id ON public.content_hub_schedules (content_id);
CREATE INDEX IF NOT EXISTS idx_content_hub_schedules_scheduled_at ON public.content_hub_schedules (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_content_hub_schedules_status ON public.content_hub_schedules (status);

-- RLS for schedules
DROP POLICY IF EXISTS "Admins can manage content schedules" ON public.content_hub_schedules;
CREATE POLICY "Admins can manage content schedules"
    ON public.content_hub_schedules FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS trg_set_updated_at_content_hub_schedules ON public.content_hub_schedules;
CREATE TRIGGER trg_set_updated_at_content_hub_schedules
    BEFORE UPDATE ON public.content_hub_schedules
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==============================================================================
-- 3. ROW LEVEL SECURITY POLICIES
-- ==============================================================================

-- Enable RLS on content_hub
ALTER TABLE public.content_hub ENABLE ROW LEVEL SECURITY;

-- Admin policy: admins can manage all content
DROP POLICY IF EXISTS "Admins can manage content hub" ON public.content_hub;
CREATE POLICY "Admins can manage content hub"
    ON public.content_hub FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Staff/Organizer policy: staff can manage content (for content they created or for their portals)
DROP POLICY IF EXISTS "Staff can manage content hub" ON public.content_hub;
CREATE POLICY "Staff can manage content hub"
    ON public.content_hub FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('staff', 'organizer', 'admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('staff', 'organizer', 'admin')
        )
    );

-- Portal user policy: users can view content targeted to their portal
DROP POLICY IF EXISTS "Users can view targeted content" ON public.content_hub;
CREATE POLICY "Users can view targeted content"
    ON public.content_hub FOR SELECT
    TO authenticated
    USING (
        status = 'published'
        AND deleted_at IS NULL
        AND (expires_at IS NULL OR expires_at > now())
        AND (
            -- All portals
            target_audiences @> ARRAY['all']::portal_audience[]
            OR
            -- User's specific portal audience matches
            target_audiences @> ARRAY[public.get_user_portal_audience()]::portal_audience[]
            -- Legacy single audience support
            OR target_audience = 'all'
            OR target_audience = (
                CASE public.get_user_portal_audience()
                    WHEN 'team_leader' THEN 'teams'
                    WHEN 'participant' THEN 'participants'
                    WHEN 'staff' THEN 'staff'
                    WHEN 'judge' THEN 'judges'
                    WHEN 'operations' THEN 'ops'
                    ELSE public.get_user_portal_audience()::TEXT
                END
            )
        )
    );

-- Content hub attachments RLS
ALTER TABLE public.content_hub_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view attachments of accessible content" ON public.content_hub_attachments;
CREATE POLICY "Users can view attachments of accessible content"
    ON public.content_hub_attachments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.content_hub ch
            WHERE ch.id = content_hub_attachments.content_id
                AND ch.status = 'published'
                AND ch.deleted_at IS NULL
                AND (ch.expires_at IS NULL OR ch.expires_at > now())
                AND (
                    ch.target_audiences @> ARRAY['all']::portal_audience[]
                    OR ch.target_audiences @> ARRAY[public.get_user_portal_audience()]::portal_audience[]
                    OR ch.target_audience = 'all'
                    OR ch.target_audience = (
                        CASE public.get_user_portal_audience()
                            WHEN 'team_leader' THEN 'teams'
                            WHEN 'participant' THEN 'participants'
                            WHEN 'staff' THEN 'staff'
                            WHEN 'judge' THEN 'judges'
                            WHEN 'operations' THEN 'ops'
                            ELSE public.get_user_portal_audience()::TEXT
                        END
                    )
                )
        )
    );

-- Admin can manage attachments
DROP POLICY IF EXISTS "Admins can manage content hub attachments" ON public.content_hub_attachments;
CREATE POLICY "Admins can manage content hub attachments"
    ON public.content_hub_attachments FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Staff can manage attachments for their content
DROP POLICY IF EXISTS "Staff can manage content hub attachments" ON public.content_hub_attachments;
CREATE POLICY "Staff can manage content hub attachments"
    ON public.content_hub_attachments FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.content_hub ch
            WHERE ch.id = content_hub_attachments.content_id
                AND ch.created_by = auth.uid()
        )
        OR public.is_admin()
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.content_hub ch
            WHERE ch.id = content_hub_attachments.content_id
                AND ch.created_by = auth.uid()
        )
        OR public.is_admin()
    );

-- Content hub audit RLS
ALTER TABLE public.content_hub_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view content hub audit" ON public.content_hub_audit;
CREATE POLICY "Admins can view content hub audit"
    ON public.content_hub_audit FOR SELECT
    TO authenticated
    USING (public.is_admin());

-- ==============================================================================
-- 4. STORAGE BUCKET
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('content-hub', 'content-hub', false, 52428800)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit;

-- Storage policies for content-hub bucket
DROP POLICY IF EXISTS "Authenticated users can view content hub files" ON storage.objects;
CREATE POLICY "Authenticated users can view content hub files"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'content-hub'
        AND EXISTS (
            SELECT 1 FROM public.content_hub_attachments ca
            JOIN public.content_hub ch ON ch.id = ca.content_id
            WHERE ca.path = storage.objects.name
                AND ch.status = 'published'
                AND ch.deleted_at IS NULL
                AND (ch.expires_at IS NULL OR ch.expires_at > now())
                AND (
                    ch.target_audiences @> ARRAY['all']::portal_audience[]
                    OR ch.target_audiences @> ARRAY[public.get_user_portal_audience()]::portal_audience[]
                )
        )
    );

DROP POLICY IF EXISTS "Admins can manage content hub files" ON storage.objects;
CREATE POLICY "Admins can manage content hub files"
    ON storage.objects FOR ALL
    TO authenticated
    USING (bucket_id = 'content-hub' AND public.is_admin())
    WITH CHECK (bucket_id = 'content-hub' AND public.is_admin());

DROP POLICY IF EXISTS "Staff can upload content hub files" ON storage.objects;
CREATE POLICY "Staff can upload content hub files"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'content-hub'
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('staff', 'organizer', 'admin')
        )
    );

-- ==============================================================================
-- 5. HELPER FUNCTIONS FOR CONTENT MANAGEMENT
-- ==============================================================================

-- Function to write audit log
CREATE OR REPLACE FUNCTION public.write_content_hub_audit(
    p_content_id UUID,
    p_action TEXT,
    p_previous_data JSONB DEFAULT NULL,
    p_new_data JSONB DEFAULT NULL,
    p_performed_by UUID DEFAULT NULL,
    p_details JSONB DEFAULT '{}'::jsonb
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.content_hub_audit (
        content_id,
        action,
        previous_data,
        new_data,
        performed_by,
        details
    ) VALUES (
        p_content_id,
        p_action,
        p_previous_data,
        p_new_data,
        p_performed_by,
        p_details
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get content for a specific portal audience
CREATE OR REPLACE FUNCTION public.get_content_for_portal(
    p_audience portal_audience DEFAULT NULL,
    p_content_type content_type DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_status content_status DEFAULT 'published',
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
) RETURNS TABLE (
    id UUID,
    reference_number TEXT,
    title TEXT,
    summary TEXT,
    body TEXT,
    content_type content_type,
    category TEXT,
    status content_status,
    priority_level TEXT,
    pin_to_top BOOLEAN,
    target_audiences portal_audience[],
    target_audience TEXT,
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    metadata JSONB,
    domain TEXT,
    team_limit INT,
    enable_selection BOOLEAN,
    manual_lock BOOLEAN,
    selection_opening TIMESTAMPTZ,
    selection_closing TIMESTAMPTZ,
    recipient TEXT,
    team_name TEXT,
    resource_url TEXT,
    attachment_url TEXT,
    attachment_name TEXT,
    resource_links JSONB,
    created_by UUID,
    updated_by UUID,
    published_by UUID,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    published_at_col TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
) AS $$
DECLARE
    v_audience portal_audience := COALESCE(p_audience, public.get_user_portal_audience());
BEGIN
    RETURN QUERY
    SELECT
        ch.id,
        ch.reference_number,
        ch.title,
        ch.summary,
        ch.body,
        ch.content_type,
        ch.category,
        ch.status,
        ch.priority_level,
        ch.pin_to_top,
        ch.target_audiences,
        ch.target_audience,
        ch.scheduled_at,
        ch.published_at,
        ch.expires_at,
        ch.metadata,
        ch.domain,
        ch.team_limit,
        ch.enable_selection,
        ch.manual_lock,
        ch.selection_opening,
        ch.selection_closing,
        ch.recipient,
        ch.team_name,
        ch.resource_url,
        ch.attachment_url,
        ch.attachment_name,
        ch.resource_links,
        ch.created_by,
        ch.updated_by,
        ch.published_by,
        ch.created_at,
        ch.updated_at,
        ch.published_at,
        ch.expires_at
    FROM public.content_hub ch
    WHERE ch.status = p_status
        AND ch.deleted_at IS NULL
        AND (ch.expires_at IS NULL OR ch.expires_at > now())
        AND (
            ch.target_audiences @> ARRAY['all']::portal_audience[]
            OR ch.target_audiences @> ARRAY[v_audience]::portal_audience[]
            OR ch.target_audience = 'all'
            OR ch.target_audience = (
                CASE v_audience
                    WHEN 'team_leader' THEN 'teams'
                    WHEN 'participant' THEN 'participants'
                    WHEN 'staff' THEN 'staff'
                    WHEN 'judge' THEN 'judges'
                    WHEN 'operations' THEN 'ops'
                    ELSE v_audience::TEXT
                END
            )
        )
        AND (p_content_type IS NULL OR ch.content_type = p_content_type)
        AND (p_category IS NULL OR ch.category = p_category)
    ORDER BY ch.pin_to_top DESC, ch.published_at DESC NULLS LAST, ch.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get content for admin (with admin access)
CREATE OR REPLACE FUNCTION public.get_content_hub_admin(
    p_status content_status DEFAULT NULL,
    p_content_type content_type DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
) RETURNS TABLE (
    id UUID,
    reference_number TEXT,
    title TEXT,
    summary TEXT,
    body TEXT,
    content_type content_type,
    category TEXT,
    status content_status,
    priority_level TEXT,
    pin_to_top BOOLEAN,
    target_audiences portal_audience[],
    target_audience TEXT,
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    metadata JSONB,
    domain TEXT,
    team_limit INT,
    enable_selection BOOLEAN,
    manual_lock BOOLEAN,
    selection_opening TIMESTAMPTZ,
    selection_closing TIMESTAMPTZ,
    recipient TEXT,
    team_name TEXT,
    resource_url TEXT,
    attachment_url TEXT,
    attachment_name TEXT,
    resource_links JSONB,
    created_by UUID,
    updated_by UUID,
    published_by UUID,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    published_at_col TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
) AS $$
BEGIN
    IF NOT public.is_admin() AND NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('staff', 'organizer')
    ) THEN
        RAISE EXCEPTION 'Insufficient permissions';
    END IF;

    RETURN QUERY
    SELECT
        ch.id,
        ch.reference_number,
        ch.title,
        ch.summary,
        ch.body,
        ch.content_type,
        ch.category,
        ch.status,
        ch.priority_level,
        ch.pin_to_top,
        ch.target_audiences,
        ch.target_audience,
        ch.scheduled_at,
        ch.published_at,
        ch.expires_at,
        ch.metadata,
        ch.domain,
        ch.team_limit,
        ch.enable_selection,
        ch.manual_lock,
        ch.selection_opening,
        ch.selection_closing,
        ch.recipient,
        ch.team_name,
        ch.resource_url,
        ch.attachment_url,
        ch.attachment_name,
        ch.resource_links,
        ch.created_by,
        ch.updated_by,
        ch.published_by,
        ch.created_at,
        ch.updated_at,
        ch.published_at,
        ch.expires_at,
        ch.deleted_at
    FROM public.content_hub ch
    WHERE (p_status IS NULL OR ch.status = p_status)
        AND (p_content_type IS NULL OR ch.content_type = p_content_type)
        AND (p_category IS NULL OR ch.category = p_category)
        AND ch.deleted_at IS NULL
    ORDER BY ch.pin_to_top DESC, ch.published_at DESC NULLS LAST, ch.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_content_for_portal(portal_audience, content_type, TEXT, content_status, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_content_hub_admin(content_status, content_type, TEXT, INT, INT) TO authenticated;

-- ==============================================================================
-- 6. SCHEDULED PUBLICATION PROCESSING
-- ==============================================================================

-- Function to process scheduled publications
CREATE OR REPLACE FUNCTION public.process_content_hub_schedules()
RETURNS VOID AS $$
DECLARE
    v_schedule RECORD;
    v_content RECORD;
BEGIN
    -- Process pending publications
    FOR v_schedule IN
        SELECT s.*, c.*
        FROM public.content_hub_schedules s
        JOIN public.content_hub c ON c.id = s.content_id
        WHERE s.status = 'pending'
            AND s.job_type = 'publish'
            AND s.scheduled_at <= now()
    LOOP
        UPDATE public.content_hub_schedules
        SET status = 'processing', updated_at = now()
        WHERE id = v_schedule.id;

        BEGIN
            UPDATE public.content_hub
            SET
                status = 'published',
                published_at = now(),
                updated_at = now()
            WHERE id = v_schedule.content_id;

            UPDATE public.content_hub_schedules
            SET status = 'completed', executed_at = now(), updated_at = now()
            WHERE id = v_schedule.id;

            PERFORM public.write_content_hub_audit(
                v_schedule.content_id,
                'published_scheduled',
                jsonb_build_object('status', 'scheduled'),
                jsonb_build_object('status', 'published', 'published_at', now()),
                NULL,
                jsonb_build_object('schedule_id', v_schedule.id)
            );
        EXCEPTION WHEN OTHERS THEN
            UPDATE public.content_hub_schedules
            SET status = 'failed', error_message = SQLERRM, updated_at = now()
            WHERE id = v_schedule.id;
        END;
    END LOOP;

    -- Process pending expirations
    FOR v_schedule IN
        SELECT s.*, c.*
        FROM public.content_hub_schedules s
        JOIN public.content_hub c ON c.id = s.content_id
        WHERE s.status = 'pending'
            AND s.job_type = 'expire'
            AND s.scheduled_at <= now()
    LOOP
        UPDATE public.content_hub_schedules
        SET status = 'processing', updated_at = now()
        WHERE id = v_schedule.id;

        BEGIN
            UPDATE public.content_hub
            SET
                status = 'unpublished',
                updated_at = now()
            WHERE id = v_schedule.content_id;

            UPDATE public.content_hub_schedules
            SET status = 'completed', executed_at = now(), updated_at = now()
            WHERE id = v_schedule.id;

            PERFORM public.write_content_hub_audit(
                v_schedule.content_id,
                'expired',
                jsonb_build_object('status', 'published'),
                jsonb_build_object('status', 'unpublished'),
                NULL,
                jsonb_build_object('schedule_id', v_schedule.id)
            );
        EXCEPTION WHEN OTHERS THEN
            UPDATE public.content_hub_schedules
            SET status = 'failed', error_message = SQLERRM, updated_at = now()
            WHERE id = v_schedule.id;
        END;
    END LOOP;

    -- Auto-expire published content that has passed expiry time
    UPDATE public.content_hub
    SET
        status = 'unpublished',
        updated_at = now()
    WHERE status = 'published'
        AND expires_at IS NOT NULL
        AND expires_at <= now()
        AND deleted_at IS NULL
        AND NOT EXISTS (
            SELECT 1 FROM public.content_hub_schedules s
            WHERE s.content_id = content_hub.id
                AND s.job_type = 'expire'
                AND s.status IN ('pending', 'processing')
        );

    -- Auto-expire: log audit (simplified - in production log each)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.process_content_hub_schedules() TO authenticated;

-- ==============================================================================
-- 7. GRANT PERMISSIONS
-- ==============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_hub TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_hub_attachments TO authenticated;
GRANT SELECT ON public.content_hub_audit TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_hub_schedules TO authenticated;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- End of migration