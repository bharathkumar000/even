-- ==============================================================================
-- 037_add_username_to_profiles.sql
-- Add username column to profiles with case-insensitive uniqueness.
-- Safe for existing production data (idempotent, no destructive operations).
-- ==============================================================================

-- 1. Add username column to profiles (nullable for existing users without one)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'username'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN username TEXT;
  END IF;
END $$;

-- 2. Create unique index on lowercase(username) for case-insensitive uniqueness.
--    Multiple NULLs are allowed (unique indexes in PostgreSQL treat NULL as distinct).
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_unique
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

-- 3. Create btree index for efficient username lookup during login resolution.
CREATE INDEX IF NOT EXISTS idx_profiles_username_lookup
  ON public.profiles (username);

-- 4. Populate existing profiles with username from auth.users.user_metadata (if present)
--    This is idempotent: only sets username where it is currently NULL.
UPDATE public.profiles p
SET username = lower(au.user_metadata->>'username')
FROM auth.users au
WHERE p.id = au.id
  AND p.username IS NULL
  AND au.user_metadata ? 'username'
  AND au.user_metadata->>'username' IS NOT NULL
  AND trim(au.user_metadata->>'username') <> '';

-- 5. Grant access to the new column (RLS already covers profiles table).
GRANT SELECT, UPDATE(username) ON public.profiles TO authenticated;

-- 6. Update the handle_new_user trigger so new signups automatically populate
--    profiles.username from auth.users.user_metadata->>'username'.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, full_name, role, username, created_at
  )
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    'participant'::user_role,
    lower(COALESCE(NULLIF(trim(new.raw_user_meta_data->>'username'), ''), NULL)),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    username = COALESCE(
      public.profiles.username,
      lower(COALESCE(NULLIF(trim(EXCLUDED.username), ''), NULL))
    );
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- End of migration
