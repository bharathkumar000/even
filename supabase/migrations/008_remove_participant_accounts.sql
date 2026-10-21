-- ==============================================================================
-- IVC PULSE: Remove Participant Accounts Migration
-- Migration: 008_remove_participant_accounts.sql
-- Deletes all existing profile rows with role 'participant' and prevents new
-- accounts from being created with that role.
-- ===============================================================================

-- 1. Delete existing participants from the `profiles` table.
-- The `team_members` table has a foreign‑key `user_id` → `profiles(id)` with
-- `ON DELETE CASCADE`, so any related team_members rows will be removed
-- automatically.
DELETE FROM public.profiles WHERE role = 'participant';

-- 2. Add a check constraint to the `profiles` table that forbids inserting
-- or updating a row with role = 'participant'.
-- If the constraint already exists (e.g., from a previous revert), drop it first.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_role_not_participant'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_not_participant
      CHECK (role <> 'participant');
  END IF;
EXCEPTION WHEN duplicate_object THEN
  -- Constraint already exists – ignore.
END $$;

-- 3. (Optional) Ensure existing RLS policies still allow admins,
-- judges, staff, organizer, and leaders. No change needed because the
-- `profile_role_not_participant` constraint only blocks the participant role.

-- End of migration.
