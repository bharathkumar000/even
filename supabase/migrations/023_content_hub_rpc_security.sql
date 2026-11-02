-- ==============================================================================
-- IVC EVENTRA / PULSE: Content Hub RPC Security Fix
-- Migration: 023_content_hub_rpc_security.sql
--
-- Purpose:
--   1. Create public.content_hub_can_access_audience() authorization helper
--   2. Recreate public.get_content_for_portal as SECURITY INVOKER so RLS applies
--   3. Update content_hub RLS policies to use content_hub_can_access_audience()
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. AUTHORIZATION HELPER: content_hub_can_access_audience()
--    Checks whether the authenticated user can access a specific portal audience.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.content_hub_can_access_audience(p_audience TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
    SELECT CASE p_audience
        WHEN 'all' THEN true
        WHEN 'admin' THEN EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
        WHEN 'staff' THEN EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('staff', 'organizer', 'admin')
        )
        WHEN 'organizer' THEN EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'organizer'
        )
        WHEN 'operations' THEN EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('staff', 'organizer', 'admin')
        )
        WHEN 'judge' THEN (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid() AND role = 'judge'
            )
            OR EXISTS (
                SELECT 1 FROM public.judge_assignments
                WHERE judge_id = auth.uid()
            )
        )
        WHEN 'team_leader' THEN EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.user_id = auth.uid() AND tm.role = 'leader'
        )
        WHEN 'participant' THEN EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.user_id = auth.uid() AND tm.role = 'member'
        )
        ELSE false
    END;
$$;

-- ------------------------------------------------------------------------------
-- 2. RECREATE get_content_for_portal AS SECURITY INVOKER
--    Runs with the caller's privileges so RLS policies on content_hub apply.
--    No service-role bypass. The caller must be authenticated.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_content_for_portal(
    portal_audience, content_type, TEXT, content_status, INT, INT
);

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
    expires_at_col TIMESTAMPTZ
) LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
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
    WHERE ch.deleted_at IS NULL
      AND (ch.expires_at IS NULL OR ch.expires_at > now())
      AND (
          -- Audience must be accessible by the caller
          public.content_hub_can_access_audience('all')
          OR
          -- Content targets 'all' portals
          ch.target_audiences @> ARRAY['all']::portal_audience[]
          OR
          -- Content targets the caller's resolved audience
          ch.target_audiences @> ARRAY[v_audience]::portal_audience[]
          OR
          -- Legacy single audience match
          ch.target_audience = 'all'
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
      AND (p_status IS NULL OR ch.status = p_status)
      AND (p_content_type IS NULL OR ch.content_type = p_content_type)
      AND (p_category IS NULL OR ch.category = p_category)
    ORDER BY ch.pin_to_top DESC, ch.published_at DESC NULLS LAST, ch.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_content_for_portal(
    portal_audience, content_type, TEXT, content_status, INT, INT
) TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. UPDATE content_hub RLS POLICIES TO USE content_hub_can_access_audience()
-- ------------------------------------------------------------------------------

-- Ensure RLS is enabled
ALTER TABLE public.content_hub ENABLE ROW LEVEL SECURITY;

-- Admin manage: admins can manage all content
DROP POLICY IF EXISTS "Admins can manage content hub" ON public.content_hub;
CREATE POLICY "Admins can manage content hub"
    ON public.content_hub FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Staff/Organizer manage: staff can manage content
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

-- Portal user view: users can view published, non-expired, non-deleted content
-- targeted to their portal audience. Uses content_hub_can_access_audience().
DROP POLICY IF EXISTS "Users can view targeted content" ON public.content_hub;
CREATE POLICY "Users can view targeted content"
    ON public.content_hub FOR SELECT
    TO authenticated
    USING (
        status = 'published'
        AND deleted_at IS NULL
        AND (expires_at IS NULL OR expires_at > now())
        AND (
            -- Content targets all portals
            target_audiences @> ARRAY['all']::portal_audience[]
            OR
            -- Caller can access the resolved audience via the helper
            public.content_hub_can_access_audience(
                COALESCE(
                    (target_audiences)[1],
                    target_audience::portal_audience
                )
            )
            OR
            -- Explicit audience array contains the caller's resolved audience
            target_audiences @> ARRAY[public.get_user_portal_audience()]::portal_audience[]
            OR
            -- Legacy single audience match
            target_audience = 'all'
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

-- ------------------------------------------------------------------------------
-- 4. FORCE POSTGRest SCHEMA RELOAD NOTICE
--    After applying this migration, run:
--    NOTIFY pgrst, 'reload schema';
-- ------------------------------------------------------------------------------
