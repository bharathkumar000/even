-- ==============================================================================
-- 021_announcements_multi_audience.sql
-- Extend announcements to support multiple target portal audiences via a
-- PostgreSQL text array column, alongside the existing single-value
-- target_audience TEXT column for backward compatibility.
-- ==============================================================================

-- 1. Add target_audiences array column (additive, nullable)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'announcements'
      AND column_name = 'target_audiences'
  ) THEN
    ALTER TABLE public.announcements
      ADD COLUMN target_audiences TEXT[];
  END IF;
END $$;

-- 2. Migrate existing single-value target_audience into target_audiences
--    Preserve existing announcements; 'all' stays as a single-element array.
UPDATE public.announcements
SET target_audiences = ARRAY[target_audience]
WHERE target_audiences IS NULL;

-- 3. Backfill 'all' for any rows that somehow ended up NULL in target_audience
UPDATE public.announcements
SET target_audience = 'all'
WHERE target_audience IS NULL;

-- 4. Index for array-based queries (GIN index supports overlap/contains operators)
CREATE INDEX IF NOT EXISTS idx_announcements_target_audiences
  ON public.announcements USING GIN (target_audiences);

-- 5. RLS policy update: allow viewing when any audience in the array matches
--    Drop and recreate the existing SELECT policy to cover both columns.
DROP POLICY IF EXISTS "Users can view targeted announcements" ON public.announcements;

CREATE POLICY "Users can view targeted announcements"
ON public.announcements
FOR SELECT
TO authenticated
USING (
  -- Single-value column (legacy): keep existing behavior
  target_audience = 'all'
  OR (target_audience = 'teams' AND EXISTS (SELECT 1 FROM public.team_members WHERE user_id = auth.uid()))
  OR (target_audience = 'judges' AND EXISTS (SELECT 1 FROM public.judge_assignments WHERE judge_id = auth.uid()))
  OR (target_audience = 'ops' AND public.is_staff_or_admin())
  -- New array column: check if current user's portal matches any selected audience
  OR (
    target_audiences IS NOT NULL
    AND (
      target_audiences @> ARRAY['all']
      OR (
        target_audiences @> ARRAY['teams']
        AND EXISTS (SELECT 1 FROM public.team_members WHERE user_id = auth.uid())
      )
      OR (
        target_audiences @> ARRAY['participants']
        AND EXISTS (SELECT 1 FROM public.team_members WHERE user_id = auth.uid())
      )
      OR (
        target_audiences @> ARRAY['judges']
        AND EXISTS (SELECT 1 FROM public.judge_assignments WHERE judge_id = auth.uid())
      )
      OR (
        target_audiences @> ARRAY['ops']
        AND public.is_staff_or_admin()
      )
      OR (
        target_audiences @> ARRAY['staff']
        AND public.is_staff_or_admin()
      )
      OR (
        target_audiences @> ARRAY['organizers']
        AND public.is_staff_or_admin()
      )
      OR (
        target_audiences @> ARRAY['admin']
        AND EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      )
    )
  )
);

-- 6. Ensure admins can still manage all announcements (existing policy from 007/014)
--    No change needed if already present; re-create for safety.
DROP POLICY IF EXISTS "Admins and staff can manage announcements" ON public.announcements;

CREATE POLICY "Admins and staff can manage announcements"
ON public.announcements
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'staff', 'organizer')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'staff', 'organizer')
  )
);

-- 7. Update the existing RPC function to support array audiences
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
    target_audiences TEXT[],
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    pin_to_top BOOLEAN,
    attachment_url TEXT,
    attachment_name TEXT,
    resource_links JSONB,
    created_at TIMESTAMPTZ,
    published_at_col TIMESTAMPTZ
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
        a.target_audiences,
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
            -- Single-value legacy column
            a.target_audience = 'all'
            OR a.target_audience = p_audience
            -- New array column
            OR (
                a.target_audiences IS NOT NULL
                AND (
                    a.target_audiences @> ARRAY['all']
                    OR a.target_audiences @> ARRAY[p_audience]
                )
            )
        )
        -- Portal-specific authorization checks
        AND (
            a.target_audience = 'all'
            OR a.target_audiences @> ARRAY['all']
            OR (
                p_audience = 'teams'
                AND EXISTS (SELECT 1 FROM public.team_members WHERE user_id = auth.uid())
            )
            OR (
                p_audience = 'participants'
                AND EXISTS (SELECT 1 FROM public.team_members WHERE user_id = auth.uid())
            )
            OR (
                p_audience = 'judges'
                AND EXISTS (SELECT 1 FROM public.judge_assignments WHERE judge_id = auth.uid())
            )
            OR (
                p_audience IN ('ops', 'staff', 'organizers')
                AND public.is_staff_or_admin()
            )
            OR (
                p_audience = 'admin'
                AND EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE id = auth.uid() AND role = 'admin'
                )
            )
        )
    ORDER BY a.is_pinned DESC, a.published_at DESC NULLS LAST, a.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_announcements_for_audience(TEXT, INT) TO authenticated;

-- End of migration
