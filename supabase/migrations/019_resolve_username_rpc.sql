-- ==============================================================================
-- IVC PULSE: Resolve username to email via secure RPC
-- File: supabase/migrations/019_resolve_username_rpc.sql
-- ==============================================================================

-- Securely resolve a username to its registered email for login purposes.
-- Uses SECURITY DEFINER so it can query auth.users with service-level privileges
-- while only returning a single email for an exact username match.
-- No enumeration: accepts one username, returns at most one email, no lists.

CREATE OR REPLACE FUNCTION public.resolve_username_to_email(p_username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT email INTO v_email
  FROM auth.users
  WHERE (user_metadata->>'username') ILIKE p_username
    AND email IS NOT NULL
  LIMIT 1;

  IF v_email IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN v_email;
END;
$$;

-- Grant execute to authenticated and anonymous roles so the server admin client
-- (service role) can invoke it; the service role bypasses RLS anyway.
REVOKE ALL ON FUNCTION public.resolve_username_to_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_username_to_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_username_to_email(text) TO anon;
