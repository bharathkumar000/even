-- ==============================================================================
-- 015_fix_storage_policies.sql
-- Fixes storage bucket security: makes team-deliverables private and adds
-- proper RLS policies for secure file access
-- ==============================================================================

-- Helper function to check if user is staff/organizer/admin (inline for storage)
-- This avoids dependency on migration 014
-- CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
-- RETURNS BOOLEAN
-- LANGUAGE sql
-- SECURITY DEFINER
-- STABLE
-- AS $$
--   SELECT EXISTS (
--     SELECT 1 FROM public.profiles
--     WHERE id = auth.uid()
--       AND role IN ('admin', 'staff', 'organizer')
--   );
-- $$;

-- 1. Make team-deliverables bucket private
UPDATE storage.buckets
SET public = false
WHERE id = 'team-deliverables';

-- 2. Drop existing overly permissive policies
DROP POLICY IF EXISTS "Public can view team deliverables" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload team deliverables" ON storage.objects;

-- 3. Create secure policies for team-deliverables bucket

-- Policy: Team members can upload files to their own team's folder
-- Folder structure: {team_id}/{timestamp}_{filename}
CREATE POLICY "Team leaders can upload team deliverables"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'team-deliverables'
  AND (
    -- Verify user is team leader of the team folder they're uploading to
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = (split_part(name, '/', 1))::uuid
        AND user_id = auth.uid()
        AND role = 'leader'
    )
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('staff', 'organizer')
    )
  )
);

-- Policy: Team members, assigned judges, staff, and admins can view team deliverables
CREATE POLICY "Authorized users can view team deliverables"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'team-deliverables'
  AND (
    -- Team members can view their team's files
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = (split_part(name, '/', 1))::uuid
        AND user_id = auth.uid()
    )
    -- Assigned judges can view their assigned team's files
    OR EXISTS (
      SELECT 1 FROM public.judge_assignments
      WHERE team_id = (split_part(name, '/', 1))::uuid
        AND judge_id = auth.uid()
    )
    -- Staff and admins can view all
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('staff', 'organizer')
    )
  )
);

-- Policy: Team leaders can update/delete their team's files
CREATE POLICY "Team leaders can manage team deliverables"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'team-deliverables'
  AND EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = (split_part(name, '/', 1))::uuid
      AND user_id = auth.uid()
      AND role = 'leader'
  )
)
WITH CHECK (
  bucket_id = 'team-deliverables'
  AND EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = (split_part(name, '/', 1))::uuid
      AND user_id = auth.uid()
      AND role = 'leader'
  )
);

CREATE POLICY "Team leaders can delete team deliverables"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'team-deliverables'
  AND EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = (split_part(name, '/', 1))::uuid
      AND user_id = auth.uid()
      AND role = 'leader'
  )
);

-- Policy: Admins have full access to all files
CREATE POLICY "Admins have full access to team deliverables"
ON storage.objects
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 4. Ensure content-releases bucket is private (already private, verify)
UPDATE storage.buckets
SET public = false
WHERE id = 'content-releases';

-- 5. Add policies for content-releases bucket
DROP POLICY IF EXISTS "Admins can read content release audit" ON storage.objects;

CREATE POLICY "Admins can manage content releases"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'content-releases'
  AND public.is_admin()
)
WITH CHECK (
  bucket_id = 'content-releases'
  AND public.is_admin()
);

-- End of migration