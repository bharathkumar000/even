-- ==============================================================================
-- 024_dynamic_submission_forms.sql
-- Dynamic Team Submission & Assessment Form Builder
--
-- Adds tables for administrator-controlled dynamic submission forms:
--   submission_forms      - Form definitions with publication/submission state
--   form_sections         - Sections within forms
--   form_questions        - Questions with type, config, validation rules
--   team_submission_drafts - Draft answers per team per form (JSONB)
--   team_submission_final  - Final submitted answers per team per form (JSONB)
--   submission_attachments - File attachments linked to submissions
--   submission_schedules  - Scheduled publication/submission windows
-- ==============================================================================

-- ------------------------------------------------------------
-- 1. ENUM / TYPE DEFINITIONS
-- ------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE submission_form_status AS ENUM (
        'draft', 'scheduled', 'published', 'unpublished', 'archived'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE submission_state AS ENUM (
        'not_open', 'open', 'closed', 'locked'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE question_type AS ENUM (
        'short_answer', 'long_answer', 'single_choice', 'multiple_choice',
        'dropdown', 'yes_no', 'checkbox', 'number', 'email', 'url',
        'date', 'time', 'datetime', 'file_upload', 'image_upload',
        'video_link', 'rating', 'linear_scale', 'section_heading'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE submission_version_status AS ENUM (
        'draft', 'submitted', 'resubmission_requested', 'approved', 'rejected'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ------------------------------------------------------------
-- 2. SUBMISSION FORMS TABLE
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.submission_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    round_id UUID REFERENCES public.evaluation_rounds(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    form_status submission_form_status NOT NULL DEFAULT 'draft',
    submission_state submission_state NOT NULL DEFAULT 'not_open',

    -- Scheduling
    view_available_at TIMESTAMPTZ,
    submission_open_at TIMESTAMPTZ,
    submission_close_at TIMESTAMPTZ,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',

    -- Configuration
    allow_early_view BOOLEAN NOT NULL DEFAULT false,
    allow_draft_before_open BOOLEAN NOT NULL DEFAULT false,
    allow_edit_after_submit BOOLEAN NOT NULL DEFAULT false,
    allow_resubmission BOOLEAN NOT NULL DEFAULT false,
    resubmission_policy TEXT NOT NULL DEFAULT 'none'
        CHECK (resubmission_policy IN ('none', 'until_deadline', 'after_approval')),
    auto_lock_at_deadline BOOLEAN NOT NULL DEFAULT true,
    allow_member_submit BOOLEAN NOT NULL DEFAULT false,

    -- Evaluation
    max_marks NUMERIC DEFAULT 100,
    evaluation_criteria_id UUID REFERENCES public.evaluation_criteria(id) ON DELETE SET NULL,

    -- Audit
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_submission_forms_event_id ON public.submission_forms (event_id);
CREATE INDEX IF NOT EXISTS idx_submission_forms_round_id ON public.submission_forms (round_id);
CREATE INDEX IF NOT EXISTS idx_submission_forms_form_status ON public.submission_forms (form_status);
CREATE INDEX IF NOT EXISTS idx_submission_forms_submission_state ON public.submission_forms (submission_state);
CREATE INDEX IF NOT EXISTS idx_submission_forms_submission_open_at ON public.submission_forms (submission_open_at);
CREATE INDEX IF NOT EXISTS idx_submission_forms_submission_close_at ON public.submission_forms (submission_close_at);

-- ------------------------------------------------------------
-- 3. FORM SECTIONS TABLE
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.form_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES public.submission_forms(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    is_required BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_sections_form_id ON public.form_sections (form_id);
CREATE INDEX IF NOT EXISTS idx_form_sections_sort_order ON public.form_sections (sort_order);

-- ------------------------------------------------------------
-- 4. FORM QUESTIONS TABLE
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.form_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES public.form_sections(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    placeholder TEXT,
    question_type question_type NOT NULL DEFAULT 'short_answer',
    is_required BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 0,
    default_value TEXT,
    min_chars INT,
    max_chars INT,
    min_value NUMERIC,
    max_value NUMERIC,
    max_selections INT,
    max_file_size INT, -- in bytes
    max_attachments INT DEFAULT 1,
    allowed_file_types TEXT[], -- array of extensions e.g. ['pdf', 'jpg']
    validation_rules JSONB DEFAULT '{}'::jsonb,
    conditional_visibility JSONB DEFAULT '{}'::jsonb, -- { depends_on_question_id, operator, value }
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_questions_section_id ON public.form_questions (section_id);
CREATE INDEX IF NOT EXISTS idx_form_questions_sort_order ON public.form_questions (sort_order);
CREATE INDEX IF NOT EXISTS idx_form_questions_question_type ON public.form_questions (question_type);

-- MCQ options stored as separate table for proper querying
CREATE TABLE IF NOT EXISTS public.form_question_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.form_questions(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    option_value TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_question_options_question_id ON public.form_question_options (question_id);

-- ------------------------------------------------------------
-- 5. TEAM SUBMISSION DRAFTS TABLE
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.team_submission_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES public.submission_forms(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    answers JSONB NOT NULL DEFAULT '{}'::jsonb, -- { question_id: answer_value }
    file_references JSONB NOT NULL DEFAULT '[]'::jsonb, -- [ { question_id, file_name, path, size } ]
    last_saved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    last_saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_team_draft UNIQUE (form_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_team_submission_drafts_form_id ON public.team_submission_drafts (form_id);
CREATE INDEX IF NOT EXISTS idx_team_submission_drafts_team_id ON public.team_submission_drafts (team_id);

-- ------------------------------------------------------------
-- 6. TEAM SUBMISSION FINAL TABLE
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.team_submission_final (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES public.submission_forms(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    version INT NOT NULL DEFAULT 1,
    status submission_version_status NOT NULL DEFAULT 'submitted',
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
    CONSTRAINT uq_team_final_v1 UNIQUE (form_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_team_submission_final_form_id ON public.team_submission_final (form_id);
CREATE INDEX IF NOT EXISTS idx_team_submission_final_team_id ON public.team_submission_final (team_id);
CREATE INDEX IF NOT EXISTS idx_team_submission_final_status ON public.team_submission_final (status);
CREATE INDEX IF NOT EXISTS idx_team_submission_final_reference ON public.team_submission_final (reference_number);

-- Submission versions history
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

CREATE INDEX IF NOT EXISTS idx_submission_versions_submission_id ON public.submission_versions (submission_id);

-- ------------------------------------------------------------
-- 7. SUBMISSION ATTACHMENTS TABLE
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.submission_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES public.team_submission_final(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_submission_attachments_submission_id ON public.submission_attachments (submission_id);
CREATE INDEX IF NOT EXISTS idx_submission_attachments_draft_id ON public.submission_attachments (draft_id);
CREATE INDEX IF NOT EXISTS idx_submission_attachments_question_id ON public.submission_attachments (question_id);

-- ------------------------------------------------------------
-- 8. SUBMISSION SCHEDULES TABLE
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.submission_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES public.submission_forms(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL DEFAULT 'publish'
        CHECK (job_type IN ('publish', 'unpublish', 'open_submissions', 'close_submissions', 'lock_submissions')),
    scheduled_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    error_message TEXT,
    executed_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_submission_schedules_form_id ON public.submission_schedules (form_id);
CREATE INDEX IF NOT EXISTS idx_submission_schedules_scheduled_at ON public.submission_schedules (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_submission_schedules_status ON public.submission_schedules (status);

-- ------------------------------------------------------------
-- 9. ROW LEVEL SECURITY
-- ------------------------------------------------------------

ALTER TABLE public.submission_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_submission_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_submission_final ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_schedules ENABLE ROW LEVEL SECURITY;

-- Admins can manage all form-related tables
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'submission_forms' AND policyname = 'Admins can manage submission forms') THEN
        CREATE POLICY "Admins can manage submission forms"
            ON public.submission_forms FOR ALL
            TO authenticated
            USING (public.is_admin())
            WITH CHECK (public.is_admin());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'form_sections' AND policyname = 'Admins can manage form sections') THEN
        CREATE POLICY "Admins can manage form sections"
            ON public.form_sections FOR ALL
            TO authenticated
            USING (public.is_admin())
            WITH CHECK (public.is_admin());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'form_questions' AND policyname = 'Admins can manage form questions') THEN
        CREATE POLICY "Admins can manage form questions"
            ON public.form_questions FOR ALL
            TO authenticated
            USING (public.is_admin())
            WITH CHECK (public.is_admin());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'form_question_options' AND policyname = 'Admins can manage form question options') THEN
        CREATE POLICY "Admins can manage form question options"
            ON public.form_question_options FOR ALL
            TO authenticated
            USING (public.is_admin())
            WITH CHECK (public.is_admin());
    END IF;
END $$;

-- Authenticated users can view published forms
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'submission_forms' AND policyname = 'Users can view published forms') THEN
        CREATE POLICY "Users can view published forms"
            ON public.submission_forms FOR SELECT
            TO authenticated
            USING (
                form_status = 'published'
                AND (
                    submission_state = 'open'
                    OR submission_state = 'not_open'
                    OR (submission_state = 'closed' AND allow_early_view)
                )
            );
    END IF;
END $$;

-- Users can view sections and questions of forms they can see
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'form_sections' AND policyname = 'Users can view sections of visible forms') THEN
        CREATE POLICY "Users can view sections of visible forms"
            ON public.form_sections FOR SELECT
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.submission_forms sf
                    WHERE sf.id = form_sections.form_id
                    AND sf.form_status = 'published'
                )
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'form_questions' AND policyname = 'Users can view questions of visible forms') THEN
        CREATE POLICY "Users can view questions of visible forms"
            ON public.form_questions FOR SELECT
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.form_sections fs
                    JOIN public.submission_forms sf ON sf.id = fs.form_id
                    WHERE fs.id = form_questions.section_id
                    AND sf.form_status = 'published'
                )
            );
    END IF;
END $$;

-- Team members can manage their own drafts
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'team_submission_drafts' AND policyname = 'Team members can manage own drafts') THEN
        CREATE POLICY "Team members can manage own drafts"
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

-- Team members can view their own final submissions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'team_submission_final' AND policyname = 'Team members can view own final submissions') THEN
        CREATE POLICY "Team members can view own final submissions"
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

-- Admins can manage all submissions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'team_submission_final' AND policyname = 'Admins can manage all final submissions') THEN
        CREATE POLICY "Admins can manage all final submissions"
            ON public.team_submission_final FOR ALL
            TO authenticated
            USING (public.is_admin())
            WITH CHECK (public.is_admin());
    END IF;
END $$;

-- Admins can manage all drafts
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'team_submission_drafts' AND policyname = 'Admins can manage all drafts') THEN
        CREATE POLICY "Admins can manage all drafts"
            ON public.team_submission_drafts FOR ALL
            TO authenticated
            USING (public.is_admin())
            WITH CHECK (public.is_admin());
    END IF;
END $$;

-- Attachments: team members can manage their own, admins can manage all
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'submission_attachments' AND policyname = 'Team members can manage own attachments') THEN
        CREATE POLICY "Team members can manage own attachments"
            ON public.submission_attachments FOR ALL
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.team_submission_drafts d
                    WHERE d.id = submission_attachments.draft_id
                    AND EXISTS (
                        SELECT 1 FROM public.team_members tm
                        WHERE tm.team_id = d.team_id
                        AND tm.user_id = auth.uid()
                    )
                )
                OR EXISTS (
                    SELECT 1 FROM public.team_submission_final f
                    WHERE f.id = submission_attachments.submission_id
                    AND EXISTS (
                        SELECT 1 FROM public.team_members tm
                        WHERE tm.team_id = f.team_id
                        AND tm.user_id = auth.uid()
                    )
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.team_submission_drafts d
                    WHERE d.id = submission_attachments.draft_id
                    AND EXISTS (
                        SELECT 1 FROM public.team_members tm
                        WHERE tm.team_id = d.team_id
                        AND tm.user_id = auth.uid()
                    )
                )
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'submission_attachments' AND policyname = 'Admins can manage all attachments') THEN
        CREATE POLICY "Admins can manage all attachments"
            ON public.submission_attachments FOR ALL
            TO authenticated
            USING (public.is_admin())
            WITH CHECK (public.is_admin());
    END IF;
END $$;

-- Schedules: admins manage, users view
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'submission_schedules' AND policyname = 'Admins can manage submission schedules') THEN
        CREATE POLICY "Admins can manage submission schedules"
            ON public.submission_schedules FOR ALL
            TO authenticated
            USING (public.is_admin())
            WITH CHECK (public.is_admin());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'submission_schedules' AND policyname = 'Users can view submission schedules') THEN
        CREATE POLICY "Users can view submission schedules"
            ON public.submission_schedules FOR SELECT
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.submission_forms sf
                    WHERE sf.id = submission_schedules.form_id
                    AND sf.form_status = 'published'
                )
            );
    END IF;
END $$;

-- Versions: team members view own, admins manage all
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'submission_versions' AND policyname = 'Team members can view own submission versions') THEN
        CREATE POLICY "Team members can view own submission versions"
            ON public.submission_versions FOR SELECT
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.team_submission_final f
                    WHERE f.id = submission_versions.submission_id
                    AND EXISTS (
                        SELECT 1 FROM public.team_members tm
                        WHERE tm.team_id = f.team_id
                        AND tm.user_id = auth.uid()
                    )
                )
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'submission_versions' AND policyname = 'Admins can manage all submission versions') THEN
        CREATE POLICY "Admins can manage all submission versions"
            ON public.submission_versions FOR ALL
            TO authenticated
            USING (public.is_admin())
            WITH CHECK (public.is_admin());
    END IF;
END $$;

-- ------------------------------------------------------------
-- 10. STORAGE BUCKET
-- ------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('submission-attachments', 'submission-attachments', false, 104857600)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit;

-- Storage policies for submission-attachments bucket
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Authenticated users can view submission attachments') THEN
        CREATE POLICY "Authenticated users can view submission attachments"
            ON storage.objects FOR SELECT
            TO authenticated
            USING (
                bucket_id = 'submission-attachments'
                AND EXISTS (
                    SELECT 1 FROM public.submission_attachments sa
                    JOIN public.team_submission_final f ON f.id = sa.submission_id
                    WHERE sa.file_path = storage.objects.name
                    AND (
                        EXISTS (
                            SELECT 1 FROM public.team_members tm
                            WHERE tm.team_id = f.team_id
                            AND tm.user_id = auth.uid()
                        )
                        OR public.is_admin()
                    )
                )
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Admins can manage submission attachments') THEN
        CREATE POLICY "Admins can manage submission attachments"
            ON storage.objects FOR ALL
            TO authenticated
            USING (bucket_id = 'submission-attachments' AND public.is_admin())
            WITH CHECK (bucket_id = 'submission-attachments' AND public.is_admin());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Team members can upload submission attachments') THEN
        CREATE POLICY "Team members can upload submission attachments"
            ON storage.objects FOR INSERT
            TO authenticated
            WITH CHECK (
                bucket_id = 'submission-attachments'
                AND EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE id = auth.uid() AND role IN ('participant', 'leader', 'admin', 'staff', 'organizer')
                )
            );
    END IF;
END $$;

-- ------------------------------------------------------------
-- 11. HELPER FUNCTIONS
-- ------------------------------------------------------------

-- Function to process due schedules (called by cron or server-side)
CREATE OR REPLACE FUNCTION public.process_submission_schedules()
RETURNS VOID AS $$
DECLARE
    v_schedule RECORD;
    v_form RECORD;
BEGIN
    -- Process pending schedules that are due
    FOR v_schedule IN
        SELECT s.*, f.*
        FROM public.submission_schedules s
        JOIN public.submission_forms f ON f.id = s.form_id
        WHERE s.status = 'pending'
            AND s.scheduled_at <= now()
    LOOP
        UPDATE public.submission_schedules
        SET status = 'processing', updated_at = now()
        WHERE id = v_schedule.id;

        BEGIN
            CASE v_schedule.job_type
                WHEN 'publish' THEN
                    UPDATE public.submission_forms
                    SET form_status = 'published', updated_at = now()
                    WHERE id = v_schedule.form_id;
                WHEN 'unpublish' THEN
                    UPDATE public.submission_forms
                    SET form_status = 'unpublished', updated_at = now()
                    WHERE id = v_schedule.form_id;
                WHEN 'open_submissions' THEN
                    UPDATE public.submission_forms
                    SET submission_state = 'open', updated_at = now()
                    WHERE id = v_schedule.form_id;
                WHEN 'close_submissions' THEN
                    UPDATE public.submission_forms
                    SET submission_state = 'closed', updated_at = now()
                    WHERE id = v_schedule.form_id;
                WHEN 'lock_submissions' THEN
                    UPDATE public.submission_forms
                    SET submission_state = 'locked', updated_at = now()
                    WHERE id = v_schedule.form_id;
            END CASE;

            UPDATE public.submission_schedules
            SET status = 'completed', executed_at = now(), updated_at = now()
            WHERE id = v_schedule.id;

        EXCEPTION WHEN OTHERS THEN
            UPDATE public.submission_schedules
            SET status = 'failed', error_message = SQLERRM, updated_at = now()
            WHERE id = v_schedule.id;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.process_submission_schedules() TO authenticated;

-- ------------------------------------------------------------
-- 12. GRANT PERMISSIONS
-- ------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON public.submission_forms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_sections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_question_options TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_submission_drafts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_submission_final TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.submission_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.submission_attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.submission_schedules TO authenticated;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- End of migration