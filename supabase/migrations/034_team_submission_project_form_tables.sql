-- ==============================================================================
-- 034_team_submission_project_form_tables.sql
-- Team submission drafts/finals keyed to project_submission_forms (not legacy submission_forms)
-- ==============================================================================

-- ------------------------------------------------------------
-- 1. TEAM SUBMISSION DRAFTS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_submission_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES public.project_submission_forms(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    file_references JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_saved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    last_saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_team_draft_project_form UNIQUE (form_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_team_submission_drafts_project_form_id ON public.team_submission_drafts (form_id);
CREATE INDEX IF NOT EXISTS idx_team_submission_drafts_project_team_id ON public.team_submission_drafts (team_id);

-- ------------------------------------------------------------
-- 2. TEAM SUBMISSION FINAL
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_submission_final (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES public.project_submission_forms(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    version INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'submitted'
        CHECK (status IN ('draft', 'submitted', 'resubmission_requested', 'approved', 'rejected')),
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    file_references JSONB NOT NULL DEFAULT '[]'::jsonb,
    submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reference_number TEXT UNIQUE NOT NULL,
    evaluation_score NUMERIC,
    evaluation_feedback TEXT,
    evaluated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    evaluated_at TIMESTAMPTZ,
    admin_remarks TEXT,
    resubmission_requested_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_team_final_project_form_v1 UNIQUE (form_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_team_submission_final_project_form_id ON public.team_submission_final (form_id);
CREATE INDEX IF NOT EXISTS idx_team_submission_final_project_team_id ON public.team_submission_final (team_id);
CREATE INDEX IF NOT EXISTS idx_team_submission_final_project_status ON public.team_submission_final (status);
CREATE INDEX IF NOT EXISTS idx_team_submission_final_project_reference ON public.team_submission_final (reference_number);

-- ------------------------------------------------------------
-- 3. SUBMISSION VERSIONS (history)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.submission_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES public.team_submission_final(id) ON DELETE CASCADE,
    version INT NOT NULL,
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    file_references JSONB NOT NULL DEFAULT '[]'::jsonb,
    submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_submission_versions_project_submission_id ON public.submission_versions (submission_id);

-- ------------------------------------------------------------
-- 4. SUBMISSION ATTACHMENTS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.submission_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES public.team_submission_final(id) ON DELETE CASCADE,
    draft_id UUID REFERENCES public.team_submission_drafts(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.form_questions(id) ON DELETE SET NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mime_type TEXT,
    size_bytes BIGINT NOT NULL,
    uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_final BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_submission_attachments_project_submission_id ON public.submission_attachments (submission_id);
CREATE INDEX IF NOT EXISTS idx_submission_attachments_project_draft_id ON public.submission_attachments (draft_id);
CREATE INDEX IF NOT EXISTS idx_submission_attachments_project_question_id ON public.submission_attachments (question_id);

-- ------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- ------------------------------------------------------------
ALTER TABLE public.team_submission_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_submission_final ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_attachments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'team_submission_drafts' AND policyname = 'Team members can manage own project-form drafts') THEN
        CREATE POLICY "Team members can manage own project-form drafts"
            ON public.team_submission_drafts FOR ALL
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.team_members tm
                    WHERE tm.team_id = team_submission_drafts.team_id
                    AND tm.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.team_members tm
                    WHERE tm.team_id = team_submission_drafts.team_id
                    AND tm.user_id = auth.uid()
                )
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'team_submission_drafts' AND policyname = 'Admins can manage all project-form drafts') THEN
        CREATE POLICY "Admins can manage all project-form drafts"
            ON public.team_submission_drafts FOR ALL
            TO authenticated
            USING (public.is_admin())
            WITH CHECK (public.is_admin());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'team_submission_final' AND policyname = 'Team members can view own project-form finals') THEN
        CREATE POLICY "Team members can view own project-form finals"
            ON public.team_submission_final FOR SELECT
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.team_members tm
                    WHERE tm.team_id = team_submission_final.team_id
                    AND tm.user_id = auth.uid()
                )
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'team_submission_final' AND policyname = 'Admins can manage all project-form finals') THEN
        CREATE POLICY "Admins can manage all project-form finals"
            ON public.team_submission_final FOR ALL
            TO authenticated
            USING (public.is_admin())
            WITH CHECK (public.is_admin());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'team_submission_final' AND policyname = 'Team members can insert own project-form finals') THEN
        CREATE POLICY "Team members can insert own project-form finals"
            ON public.team_submission_final FOR INSERT
            TO authenticated
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.team_members tm
                    WHERE tm.team_id = team_submission_final.team_id
                    AND tm.user_id = auth.uid()
                )
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'submission_attachments' AND policyname = 'Team members can manage own project-form attachments') THEN
        CREATE POLICY "Team members can manage own project-form attachments"
            ON public.submission_attachments FOR ALL
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.team_submission_drafts d
                    WHERE d.id = submission_attachments.draft_id
                    AND EXISTS (
                        SELECT 1 FROM public.team_members tm
                        WHERE tm.team_id = d.team_id AND tm.user_id = auth.uid()
                    )
                )
                OR EXISTS (
                    SELECT 1 FROM public.team_submission_final f
                    WHERE f.id = submission_attachments.submission_id
                    AND EXISTS (
                        SELECT 1 FROM public.team_members tm
                        WHERE tm.team_id = f.team_id AND tm.user_id = auth.uid()
                    )
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.team_submission_drafts d
                    WHERE d.id = submission_attachments.draft_id
                    AND EXISTS (
                        SELECT 1 FROM public.team_members tm
                        WHERE tm.team_id = d.team_id AND tm.user_id = auth.uid()
                    )
                )
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'submission_attachments' AND policyname = 'Admins can manage all project-form attachments') THEN
        CREATE POLICY "Admins can manage all project-form attachments"
            ON public.submission_attachments FOR ALL
            TO authenticated
            USING (public.is_admin())
            WITH CHECK (public.is_admin());
    END IF;
END $$;

-- ------------------------------------------------------------
-- 6. GRANT PERMISSIONS
-- ------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_submission_drafts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_submission_final TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.submission_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.submission_attachments TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- End of migration
