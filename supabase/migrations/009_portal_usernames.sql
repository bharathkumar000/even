-- Add stable usernames for team portal accounts without changing the source
-- registration spreadsheet or the existing Supabase Auth emails.

ALTER TABLE public.portal_account_links
  ADD COLUMN IF NOT EXISTS username TEXT;

-- Existing linked teams receive a deterministic username from their team name.
-- Example: "Tech Nexus Nova" becomes "ivc-tech-nexus-nova".
UPDATE public.portal_account_links AS pal
SET username = 'ivc-' || trim(both '-' from regexp_replace(
  lower(coalesce(t.name, pal.registration_team_id)),
  '[^a-z0-9]+', '-', 'g'
))
FROM public.teams AS t
WHERE pal.team_id = t.id
  AND (pal.username IS NULL OR btrim(pal.username) = '');

-- Fallback for a linked account whose team_id is null.
UPDATE public.portal_account_links
SET username = 'ivc-' || trim(both '-' from regexp_replace(
  lower(registration_team_id), '[^a-z0-9]+', '-', 'g'
))
WHERE username IS NULL OR btrim(username) = '';

-- Fail clearly rather than silently assigning ambiguous usernames.
DO $$
BEGIN
  IF EXISTS (
    SELECT username
    FROM public.portal_account_links
    GROUP BY username
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate portal usernames generated. Resolve duplicate team-name slugs, then rerun migration 009.';
  END IF;
END $$;

ALTER TABLE public.portal_account_links
  ALTER COLUMN username SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_portal_account_links_username
  ON public.portal_account_links (lower(username));

COMMENT ON COLUMN public.portal_account_links.username IS
  'Login username for the team portal. Normal format: ivc- plus normalized team-name slug.';
