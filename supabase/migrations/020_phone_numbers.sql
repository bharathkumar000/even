-- ==============================================================================
-- 020_phone_numbers.sql
-- Add phone number field to profiles table for admin-managed contact management.
-- The spocs table already has a phone column (migration 004). This migration
-- extends phone support to all profiles (team members, staff, admins, judges).
-- ==============================================================================

-- 1. Add phone column to profiles (additive, nullable, no data loss)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN phone TEXT;
  END IF;
END $$;

-- 2. Add check constraint for valid phone format (Indian mobile, optional +91)
--    Allows: empty/null, +91XXXXXXXXXX, 91XXXXXXXXXX, XXXXXXXXXXXX, +91-XXXXXXXXXX
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%phone%'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_phone_format_check
      CHECK (
        phone IS NULL
        OR phone ~ '^(\+?91|91)?[-]?[6-9]\d{9}$'
      );
  END IF;
END $$;

-- 3. Index for phone-based lookups (admin search, team portal queries)
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);

-- 4. RLS: Team members can view their own team's profile phone numbers
--    This complements existing "Users can view own profile" and "Admins can view all profiles"
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Team members can view own team profiles'
  ) THEN
    CREATE POLICY "Team members can view own team profiles"
      ON public.profiles
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.team_members tm_self
          JOIN public.team_members tm_other
            ON tm_self.team_id = tm_other.team_id
          WHERE tm_self.user_id = auth.uid()
            AND tm_other.user_id = profiles.id
        )
      );
  END IF;
END $$;

-- 5. Ensure the existing "Users can update own profile" policy covers phone
--    (it already does via FOR UPDATE WITH CHECK auth.uid() = id, no change needed)
-- 6. Ensure the existing "Admins manage profiles" policy covers phone
--    (it already does via FOR ALL USING public.is_admin(), no change needed)

-- End of migration
