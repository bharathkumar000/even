
-- ==============================================================================
-- 029_fix_rls_recursion.sql
-- Fix infinite recursion in RLS policies for team_members table
-- 
-- Root cause: The "Team members can view own team members" and "Team leaders 
-- can manage own team members" policies on public.team_members contained 
-- recursive subqueries (SELECT FROM team_members while policy is on team_members),
-- causing PostgreSQL error 42P17: infinite recursion detected in policy.
--
-- Fix: Replace recursive subqueries with the existing SECURITY DEFINER helper 
-- functions is_team_member() and is_team_leader(), which safely query team_members 
-- with elevated privileges without re-entering the same RLS policy.
-- ==============================================================================

-- 1. Verify the helper functions exist and are correct
-- is_team_member(team_id) already exists from migration 014
-- is_team_leader(team_id) already exists from migration 014

-- 2. Replace the "Team members can view own team members" policy
--    OLD: recursive subquery on team_members
--    NEW: use is_team_member() helper function
DROP POLICY IF EXISTS "Team members can view own team members" ON public.team_members;
CREATE POLICY "Team members can view own team members"
ON public.team_members
FOR SELECT
TO authenticated
USING (public.is_team_member(team_id));

-- 3. Replace the "Team leaders can manage own team members" policy
--    OLD: recursive subquery on team_members
--    NEW: use is_team_leader() helper function
DROP POLICY IF EXISTS "Team leaders can manage own team members"
ON public.team_members
FOR ALL
TO authenticated
USING (public.is_team_leader(team_id))
WITH CHECK (public.is_team_leader(team_id));

-- 4. Keep the "Staff and admins can view all team members" policy unchanged
--    It already uses helper functions (is_staff_or_admin, is_admin) safely
--    No change needed

-- 5. Keep the "Admins can manage team members" policy unchanged
--    It already uses is_admin() which is SECURITY DEFINER
--    No change needed

-- 6. Keep the "Team members can view own team members" policy (original for reference)
--    Already dropped and replaced in step 2

-- ==============================================================================
-- VERIFICATION STEPS
-- ==============================================================================
-- After applying this migration, run the following queries to verify:

-- 1. Test profile query for all demo accounts:
-- SELECT * FROM public.profiles WHERE id = 'user-uuid-here';

-- 2. Test team_members query no longer produces error 42P17:
-- SELECT * FROM public.team_members LIMIT 10;

-- 3. Verify helper functions return correct results:
SELECT public.is_team_member('team-uuid-here') AS is_member;
SELECT public.is_team_leader('team-uuid-here') AS is_leader;

-- 4. Verify RLS is still enabled:
SELECT polname, polcmd, polroles, polcmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'team_members';

-- ==============================================================================
-- END OF MIGRATION
-- ==============================================================================
