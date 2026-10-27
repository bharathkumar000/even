-- ==============================================================================
-- 010_content_activity_hub.sql
-- Fresh-install support for the Content & Activity Hub.
--
-- The hub stores its activity/item records inside public.problem_statements
-- using namespaced JSON markers so existing problem statement data remains
-- intact:
--   resource_links.__hub_activity = { type, status, built_in }
--   resource_links.__hub_item     = { activity_id, item_type, metadata }
--   attachments[] entries with    __hub_file = true
--
-- Publication history is recorded in content_release_audit and uploaded files
-- live in the private content-releases storage bucket.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.content_release_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    statement_id UUID REFERENCES public.problem_statements(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    previous_status TEXT,
    new_status TEXT,
    performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.content_release_audit'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%action%'
    ) THEN
        ALTER TABLE public.content_release_audit
            ADD CONSTRAINT content_release_audit_action_check
            CHECK (action IN ('created', 'edited', 'published', 'unpublished', 'deleted'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS content_release_audit_statement_idx
    ON public.content_release_audit (statement_id);

CREATE INDEX IF NOT EXISTS content_release_audit_created_at_idx
    ON public.content_release_audit (created_at DESC);

ALTER TABLE public.content_release_audit ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'content_release_audit'
          AND policyname = 'Admins can read content release audit'
    ) THEN
        CREATE POLICY "Admins can read content release audit"
            ON public.content_release_audit
            FOR SELECT TO authenticated
            USING (public.is_admin());
    END IF;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('content-releases', 'content-releases', false, 52428800)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit;
