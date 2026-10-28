-- ==============================================================================
-- 009_spoc_staff_unification.sql
-- Treat Staff / Club Members as the single source of truth for SPOC identities.
-- The existing spocs table is retained as the assignment/join record so that
-- existing team_spoc_assignments and historical records remain intact.
-- ==============================================================================

-- 1. Add a link from the SPOC record to the actual staff profile.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'spocs'
      AND column_name = 'staff_id'
  ) THEN
    ALTER TABLE public.spocs
      ADD COLUMN staff_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. Link existing manual SPOC rows to staff profiles using their email address.
--    Only one SPOC row per staff member is linked so duplicate legacy rows do not
--    block the unique index created below.
WITH matched AS (
  SELECT
    p.id AS profile_id,
    s.id AS spoc_id,
    ROW_NUMBER() OVER (
      PARTITION BY p.id
      ORDER BY s.created_at ASC NULLS LAST, s.id
    ) AS row_number
  FROM public.profiles p
  JOIN public.spocs s
    ON lower(trim(coalesce(s.email, ''))) = lower(trim(coalesce(p.email, '')))
  WHERE p.role = 'staff'
    AND s.staff_id IS NULL
    AND coalesce(p.email, '') <> ''
)
UPDATE public.spocs s
SET staff_id = matched.profile_id
FROM matched
WHERE s.id = matched.spoc_id
  AND matched.row_number = 1;

-- 3. Create a linked SPOC row for every staff profile that does not have one yet.
INSERT INTO public.spocs (staff_id, name, email, created_at, updated_at)
SELECT
  p.id,
  COALESCE(NULLIF(trim(p.full_name), ''), split_part(p.email, '@', 1), 'Staff Member'),
  p.email,
  now(),
  now()
FROM public.profiles p
WHERE p.role = 'staff'
  AND NOT EXISTS (
    SELECT 1 FROM public.spocs s WHERE s.staff_id = p.id
  );

-- 4. Enforce one linked SPOC row per staff member. Multiple NULLs are allowed by
--    PostgreSQL unique indexes, so legacy/unlinked rows remain untouched.
CREATE UNIQUE INDEX IF NOT EXISTS spocs_staff_id_unique
  ON public.spocs(staff_id);

-- 5. Keep SPOC display data in sync with the staff profile identity.
CREATE OR REPLACE FUNCTION public.sync_staff_spoc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  display_name TEXT;
BEGIN
  IF NEW.role = 'staff' THEN
    display_name := COALESCE(
      NULLIF(trim(NEW.full_name), ''),
      split_part(NEW.email, '@', 1),
      'Staff Member'
    );

    IF EXISTS (SELECT 1 FROM public.spocs WHERE staff_id = NEW.id) THEN
      UPDATE public.spocs
      SET
        name = display_name,
        email = NEW.email,
        updated_at = now()
      WHERE staff_id = NEW.id;
    ELSE
      INSERT INTO public.spocs (staff_id, name, email, created_at, updated_at)
      VALUES (NEW.id, display_name, NEW.email, now(), now());
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_staff_spoc_on_profile ON public.profiles;
CREATE TRIGGER sync_staff_spoc_on_profile
  AFTER INSERT OR UPDATE OF role, full_name, email
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_staff_spoc();

