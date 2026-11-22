-- ==============================================================================
-- IVC PULSE / EVENTRA: Complete Production Database Alignment & Username RPC
-- File: supabase/migrations/045_complete_eventra_production_sync.sql
-- Description:
--   1. Ensures `username` column on public.profiles with case-insensitive unique index.
--   2. Safely backfills profiles.username from auth.users.raw_user_meta_data.
--   3. Ensures `login_username`, `login_email`, `login_password`, `team_code` on public.team_registrations.
--   4. Ensures `leader_email` on public.teams.
--   5. Creates resilient public.resolve_username_to_email(text) RPC supporting
--      staff usernames, team codes (IVC-RY-xxx), team names, and direct emails.
-- ==============================================================================

-- 1. Ensure `username` column exists on public.profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'username'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN username TEXT;
  END IF;
END $$;

-- 2. Case-insensitive unique index on profiles.username
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower_unique
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_username_lookup
  ON public.profiles (username);

-- 3. Populate existing profiles.username from auth.users.raw_user_meta_data (idempotent)
DO $$
BEGIN
  UPDATE public.profiles p
  SET username = lower(trim(au.raw_user_meta_data->>'username'))
  FROM auth.users au
  WHERE p.id = au.id
    AND p.username IS NULL
    AND au.raw_user_meta_data IS NOT NULL
    AND au.raw_user_meta_data ? 'username'
    AND trim(coalesce(au.raw_user_meta_data->>'username', '')) <> '';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping user_metadata backfill if column differs: %', SQLERRM;
END $$;

-- 4. Ensure explicit columns on public.team_registrations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_registrations' AND column_name = 'login_username'
  ) THEN
    ALTER TABLE public.team_registrations ADD COLUMN login_username TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_registrations' AND column_name = 'login_email'
  ) THEN
    ALTER TABLE public.team_registrations ADD COLUMN login_email TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_registrations' AND column_name = 'login_password'
  ) THEN
    ALTER TABLE public.team_registrations ADD COLUMN login_password TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'team_registrations' AND column_name = 'team_code'
  ) THEN
    ALTER TABLE public.team_registrations ADD COLUMN team_code TEXT;
  END IF;
END $$;

-- 5. Ensure leader_email on public.teams
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'teams' AND column_name = 'leader_email'
  ) THEN
    ALTER TABLE public.teams ADD COLUMN leader_email TEXT;
  END IF;
END $$;

-- 6. Backfill team_registrations login_email & team_code where missing
UPDATE public.team_registrations
SET login_email = lower(trim(leader_email))
WHERE login_email IS NULL AND leader_email IS NOT NULL;

UPDATE public.team_registrations
SET login_username = lower(regexp_replace(team_name, '[^a-zA-Z0-9]', '', 'g'))
WHERE login_username IS NULL AND team_name IS NOT NULL;

-- 7. High-Performance Multi-Layer RPC to resolve any username to email
CREATE OR REPLACE FUNCTION public.resolve_username_to_email(p_username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text;
  v_clean text;
  v_alphanumeric text;
BEGIN
  IF p_username IS NULL OR trim(p_username) = '' THEN
    RETURN NULL;
  END IF;

  v_clean := lower(trim(p_username));
  v_alphanumeric := regexp_replace(v_clean, '[^a-z0-9]', '', 'g');

  -- Case 0: Direct email match
  IF position('@' in v_clean) > 0 THEN
    RETURN v_clean;
  END IF;

  -- Case 1: Check profiles by username
  SELECT email INTO v_email
  FROM public.profiles
  WHERE lower(username) = v_clean
  LIMIT 1;

  IF v_email IS NOT NULL THEN
    RETURN v_email;
  END IF;

  -- Case 2: Check auth.users raw_user_meta_data
  BEGIN
    SELECT email INTO v_email
    FROM auth.users
    WHERE lower(raw_user_meta_data->>'username') = v_clean
       OR lower(email) = v_clean
    LIMIT 1;

    IF v_email IS NOT NULL THEN
      RETURN v_email;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Fall through if raw_user_meta_data has restricted permissions
  END;

  -- Case 3: Check teams by code (e.g. IVC-RY-001) or exact name
  SELECT leader_email INTO v_email
  FROM public.teams
  WHERE (lower(code) = v_clean
         OR lower(name) = v_clean
         OR regexp_replace(lower(name), '[^a-z0-9]', '', 'g') = v_alphanumeric)
    AND leader_email IS NOT NULL
  LIMIT 1;

  IF v_email IS NOT NULL THEN
    RETURN v_email;
  END IF;

  -- Case 4: Check team_registrations by team_code, login_username, or team_name
  SELECT coalesce(login_email, leader_email) INTO v_email
  FROM public.team_registrations
  WHERE (lower(team_code) = v_clean
         OR lower(login_username) = v_clean
         OR lower(team_name) = v_clean
         OR regexp_replace(lower(team_name), '[^a-z0-9]', '', 'g') = v_alphanumeric
         OR lower(generated_credentials->>'username') = v_clean
         OR lower(generated_credentials->>'teamCode') = v_clean)
    AND coalesce(login_email, leader_email) IS NOT NULL
  LIMIT 1;

  IF v_email IS NOT NULL THEN
    RETURN v_email;
  END IF;

  RETURN NULL;
END;
$$;

-- Grant execution permissions
REVOKE ALL ON FUNCTION public.resolve_username_to_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_username_to_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_username_to_email(text) TO anon;
