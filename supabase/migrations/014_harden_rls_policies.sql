-- ==============================================================================
-- 014_harden_rls_policies.sql
-- Hardens Row Level Security policies to prevent unauthorized data access
-- Implements least-privilege access for all tables
-- ==============================================================================

-- Helper function to check if user is team leader of a specific team
CREATE OR REPLACE FUNCTION public.is_team_leader(team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = is_team_leader.team_id
      AND user_id = auth.uid()
      AND role = 'leader'
  );
$$;

-- Helper function to check if user is member of a specific team
CREATE OR REPLACE FUNCTION public.is_team_member(team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = is_team_member.team_id
      AND user_id = auth.uid()
  );
$$;

-- Helper function to check if user is assigned judge for a team
CREATE OR REPLACE FUNCTION public.is_judge_for_team(team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.judge_assignments
    WHERE team_id = is_judge_for_team.team_id
      AND judge_id = auth.uid()
  );
$$;

-- Helper function to check if user is staff/organizer/admin
CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'staff', 'organizer')
  );
$$;

-- ==============================================================================
-- PROFILES TABLE - Restrict read access to own profile + admin
-- ==============================================================================
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins have full access to profiles" ON public.profiles;

-- Users can only view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Users can update their own profile (non-role fields enforced by trigger)
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Admins have full management access
CREATE POLICY "Admins manage profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ==============================================================================
-- TEAMS TABLE - Restrict to team members, staff, and admins
-- ==============================================================================
DROP POLICY IF EXISTS "Teams readable by authenticated users" ON public.teams;
DROP POLICY IF EXISTS "Admins can manage teams" ON public.teams;

-- Team members can view their own team
CREATE POLICY "Team members can view own team"
ON public.teams
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
  )
);

-- Staff and admins can view all teams
CREATE POLICY "Staff and admins can view all teams"
ON public.teams
FOR SELECT
TO authenticated
USING (public.is_staff_or_admin() OR public.is_admin());

-- Admins can manage teams
CREATE POLICY "Admins manage teams"
ON public.teams
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ==============================================================================
-- TEAM MEMBERS TABLE - Restrict to team members, staff, and admins
-- ==============================================================================
DROP POLICY IF EXISTS "Team members readable by authenticated users" ON public.team_members;
DROP POLICY IF EXISTS "Admins can manage team members" ON public.team_members;

-- Team members can view their own team's members
CREATE POLICY "Team members can view own team members"
ON public.team_members
FOR SELECT
TO authenticated
USING (
  team_id IN (
    SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
  )
);

-- Staff and admins can view all team members
CREATE POLICY "Staff and admins can view all team members"
ON public.team_members
FOR SELECT
TO authenticated
USING (public.is_staff_or_admin() OR public.is_admin());

-- Team leaders can manage their team members (add/remove)
CREATE POLICY "Team leaders can manage own team members"
ON public.team_members
FOR ALL
TO authenticated
USING (
  team_id IN (
    SELECT team_id FROM public.team_members WHERE user_id = auth.uid() AND role = 'leader'
  )
)
WITH CHECK (
  team_id IN (
    SELECT team_id FROM public.team_members WHERE user_id = auth.uid() AND role = 'leader'
  )
);

-- Admins can manage all team members
CREATE POLICY "Admins manage team members"
ON public.team_members
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ==============================================================================
-- EVALUATION ROUNDS TABLE - Restrict to relevant roles
-- ==============================================================================
DROP POLICY IF EXISTS "Rounds readable by authenticated users" ON public.evaluation_rounds;
DROP POLICY IF EXISTS "Admins can manage rounds" ON public.evaluation_rounds;

-- Team members, judges, staff can view rounds
CREATE POLICY "Participants can view rounds"
ON public.evaluation_rounds
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_members WHERE user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.judge_assignments WHERE judge_id = auth.uid()
  )
  OR public.is_staff_or_admin()
  OR public.is_admin()
);

-- Admins can manage rounds
CREATE POLICY "Admins manage evaluation rounds"
ON public.evaluation_rounds
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ==============================================================================
-- EVALUATION CRITERIA TABLE - Restrict to relevant roles
-- ==============================================================================
DROP POLICY IF EXISTS "Evaluation criteria readable by authenticated" ON public.evaluation_criteria;
DROP POLICY IF EXISTS "Admins can manage evaluation criteria" ON public.evaluation_criteria;
DROP POLICY IF EXISTS "Admins can manage criteria" ON public.evaluation_criteria;

-- Team members, judges, staff can view criteria
CREATE POLICY "Participants can view criteria"
ON public.evaluation_criteria
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_members WHERE user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.judge_assignments WHERE judge_id = auth.uid()
  )
  OR public.is_staff_or_admin()
  OR public.is_admin()
);

-- Admins can manage criteria
CREATE POLICY "Admins manage evaluation criteria"
ON public.evaluation_criteria
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ==============================================================================
-- JUDGE ASSIGNMENTS TABLE - Already restrictive, verify
-- ==============================================================================
-- Current policies are:
-- "Judges and admins can view assignments" - judge_id = auth.uid() OR is_admin()
-- "Admins can manage judge assignments" - is_admin()
-- These are appropriately restrictive

-- ==============================================================================
-- EVALUATIONS TABLE - Already restrictive, verify
-- ==============================================================================
-- Current policy: "Judges can view and manage their evaluations" - judge_id = auth.uid() OR is_admin()
-- This is appropriately restrictive

-- ==============================================================================
-- TEAM SUBMISSIONS TABLE - Already restrictive, verify
-- ==============================================================================
-- Current policies allow team members and assigned judges to view, team leaders to manage
-- These are appropriately restrictive

-- ==============================================================================
-- EVENT RESULTS TABLE - Already restrictive
-- ==============================================================================
-- Current policy: Published results viewable by team members, all by admin
-- This is appropriately restrictive

-- ==============================================================================
-- ANNOUNCEMENTS TABLE - Restrict to relevant audiences
-- ==============================================================================
DROP POLICY IF EXISTS "Anyone authenticated can view active announcements" ON public.announcements;

-- Users can view announcements targeted to them
CREATE POLICY "Users can view targeted announcements"
ON public.announcements
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND (
    target_audience = 'all'
    OR (target_audience = 'teams' AND EXISTS (SELECT 1 FROM public.team_members WHERE user_id = auth.uid()))
    OR (target_audience = 'judges' AND EXISTS (SELECT 1 FROM public.judge_assignments WHERE judge_id = auth.uid()))
    OR (target_audience = 'ops' AND public.is_staff_or_admin())
    OR public.is_admin()
  )
);

-- ==============================================================================
-- SPOCS TABLE - Restrict to staff and admins
-- ==============================================================================
DROP POLICY IF EXISTS "Admins can manage spocs" ON public.spocs;
DROP POLICY IF EXISTS "Authenticated users can view spocs" ON public.spocs;

-- Staff and admins can view SPOCs
CREATE POLICY "Staff and admins can view spocs"
ON public.spocs
FOR SELECT
TO authenticated
USING (public.is_staff_or_admin() OR public.is_admin());

-- Admins can manage SPOCs
CREATE POLICY "Admins manage spocs"
ON public.spocs
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ==============================================================================
-- TEAM SPOC ASSIGNMENTS - Restrict to staff and admins
-- ==============================================================================
DROP POLICY IF EXISTS "Admins can manage spoc assignments" ON public.team_spoc_assignments;
DROP POLICY IF EXISTS "Authenticated users can view spoc assignments" ON public.team_spoc_assignments;

-- Staff and admins can view assignments
CREATE POLICY "Staff and admins can view spoc assignments"
ON public.team_spoc_assignments
FOR SELECT
TO authenticated
USING (public.is_staff_or_admin() OR public.is_admin());

-- Admins can manage assignments
CREATE POLICY "Admins manage spoc assignments"
ON public.team_spoc_assignments
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ==============================================================================
-- JUDGE CONFLICTS - Already restrictive
-- ==============================================================================
-- Current policies: judges can view own conflicts, admins manage all
-- This is appropriately restrictive

-- ==============================================================================
-- SUBMISSION REVISIONS - Already restrictive
-- ==============================================================================
-- Current policies: team members can view own, staff/judges/admins can view all
-- This is appropriately restrictive

-- ==============================================================================
-- PROBLEM STATEMENTS - Already restrictive (published only for non-admins)
-- ==============================================================================
-- Current policies: admins manage all, authenticated users read only published
-- This is appropriately restrictive

-- ==============================================================================
-- CONTENT RELEASE AUDIT - Admin only
-- ==============================================================================
-- Current policy: Admins can read
-- This is appropriately restrictive

-- ==============================================================================
-- CONTENT SCHEDULED PUBLICATIONS - Already restrictive
-- ==============================================================================
-- Current policies: admins manage, users view pending
-- This is appropriately restrictive

-- ==============================================================================
-- TEAM PROBLEM STATEMENT ASSIGNMENTS - Already restrictive
-- ==============================================================================
-- Current policies: admins manage, team leaders view own
-- This is appropriately restrictive

-- ==============================================================================
-- AUDIT LOGS - Already restrictive (admin only)
-- ==============================================================================
-- Current policy: Audit logs only viewable by admins
-- This is appropriately restrictive

-- ==============================================================================
-- EVENT ACTIVITY LOGS - Already restrictive
-- ==============================================================================
-- Current policies: Team participants can view own team logs, staff/admins manage all
-- This is appropriately restrictive

-- End of migration