-- ==============================================================================
-- 021_staff_assigned_teams_rls.sql
-- RLS policies for staff/SPoC members to view their own assigned teams
-- ==============================================================================

-- 1. Helper function: check if authenticated user is a staff member with a linked SPOC record
CREATE OR REPLACE FUNCTION public.is_staff_with_spoc()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.spocs s ON s.staff_id = p.id
    WHERE p.id = auth.uid()
      AND p.role IN ('staff', 'organizer', 'spoc')
  );
$$;

-- 2. Helper function: get the SPOC ID for the current staff member
CREATE OR REPLACE FUNCTION public.get_my_spoc_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT s.id FROM public.spocs s
  WHERE s.staff_id = auth.uid()
  LIMIT 1;
$$;

-- 3. RLS Policy: Staff can view their own SPOC record
DROP POLICY IF EXISTS "Staff can view own spoc record" ON public.spocs;
CREATE POLICY "Staff can view own spoc record"
  ON public.spocs
  FOR SELECT
  TO authenticated
  USING (
    staff_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('staff', 'organizer', 'spoc')
    )
  );

-- 4. RLS Policy: Staff can view team_spoc_assignments for their own SPOC
DROP POLICY IF EXISTS "Staff can view own team assignments" ON public.team_spoc_assignments;
CREATE POLICY "Staff can view own team assignments"
  ON public.team_spoc_assignments
  FOR SELECT
  TO authenticated
  USING (
    spoc_id = public.get_my_spoc_id()
    AND public.is_staff_with_spoc()
  );

-- 5. RLS Policy: Staff can view teams assigned to their SPOC
-- This allows staff to see teams they are assigned to via team_spoc_assignments
DROP POLICY IF EXISTS "Staff can view assigned teams" ON public.teams;
CREATE POLICY "Staff can view assigned teams"
  ON public.teams
  FOR SELECT
  TO authenticated
  USING (
    public.is_staff_with_spoc()
    AND EXISTS (
      SELECT 1 FROM public.team_spoc_assignments tsa
      WHERE tsa.team_id = teams.id
        AND tsa.spoc_id = public.get_my_spoc_id()
    )
  );

-- 6. RLS Policy: Staff can view team members of their assigned teams
DROP POLICY IF EXISTS "Staff can view members of assigned teams" ON public.team_members;
CREATE POLICY "Staff can view members of assigned teams"
  ON public.team_members
  FOR SELECT
  TO authenticated
  USING (
    public.is_staff_with_spoc()
    AND EXISTS (
      SELECT 1 FROM public.team_spoc_assignments tsa
      WHERE tsa.team_id = team_members.team_id
        AND tsa.spoc_id = public.get_my_spoc_id()
    )
  );

-- 7. RLS Policy: Staff can view submissions of their assigned teams
DROP POLICY IF EXISTS "Staff can view submissions of assigned teams" ON public.team_submissions;
CREATE POLICY "Staff can view submissions of assigned teams"
  ON public.team_submissions
  FOR SELECT
  TO authenticated
  USING (
    public.is_staff_with_spoc()
    AND EXISTS (
      SELECT 1 FROM public.team_spoc_assignments tsa
      WHERE tsa.team_id = team_submissions.team_id
        AND tsa.spoc_id = public.get_my_spoc_id()
    )
  );

-- 8. RLS Policy: Staff can view event_results of their assigned teams
DROP POLICY IF EXISTS "Staff can view results of assigned teams" ON public.event_results;
CREATE POLICY "Staff can view results of assigned teams"
  ON public.event_results
  FOR SELECT
  TO authenticated
  USING (
    public.is_staff_with_spoc()
    AND EXISTS (
      SELECT 1 FROM public.team_spoc_assignments tsa
      WHERE tsa.team_id = event_results.team_id
        AND tsa.spoc_id = public.get_my_spoc_id()
    )
  );

-- 9. RLS Policy: Staff can view evaluation rounds (needed for submissions context)
-- Already exists: "Rounds readable by authenticated users"

-- 10. RLS Policy: Staff can view evaluation criteria (needed for context)
-- Already exists: "Evaluation criteria readable by authenticated"

-- 11. Grant execute permissions on helper functions to authenticated role
GRANT EXECUTE ON FUNCTION public.is_staff_with_spoc() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_spoc_id() TO authenticated;

-- Verification queries:
-- 1. Check if policies exist:
-- SELECT * FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('spocs', 'team_spoc_assignments', 'teams', 'team_members', 'team_submissions', 'event_results');

-- 2. Test as staff user:
-- SET ROLE authenticated;
-- SELECT * FROM public.teams WHERE EXISTS (SELECT 1 FROM public.team_spoc_assignments tsa WHERE tsa.team_id = teams.id AND tsa.spoc_id = public.get_my_spoc_id());