-- ==============================================================================
-- 033_project_submission_forms.sql
-- Project Submission Forms table with form_config JSONB storage
-- ==============================================================================

-- ------------------------------------------------------------
-- 1. Create project_submission_forms table
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_submission_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    round_id UUID REFERENCES public.evaluation_rounds(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    form_status TEXT NOT NULL DEFAULT 'draft'
        CHECK (form_status IN ('draft', 'scheduled', 'published', 'unpublished', 'archived')),
    submission_state TEXT NOT NULL DEFAULT 'not_open'
        CHECK (submission_state IN ('not_open', 'open', 'closed', 'locked')),
    version INT NOT NULL DEFAULT 1,
    view_available_at TIMESTAMPTZ,
    submission_open_at TIMESTAMPTZ,
    submission_close_at TIMESTAMPTZ,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    allow_early_view BOOLEAN NOT NULL DEFAULT false,
    allow_draft_before_open BOOLEAN NOT NULL DEFAULT false,
    allow_edit_after_submit BOOLEAN NOT NULL DEFAULT false,
    allow_resubmission BOOLEAN NOT NULL DEFAULT false,
    resubmission_policy TEXT NOT NULL DEFAULT 'none'
        CHECK (resubmission_policy IN ('none', 'until_deadline', 'after_approval')),
    auto_lock_at_deadline BOOLEAN NOT NULL DEFAULT true,
    allow_member_submit BOOLEAN NOT NULL DEFAULT false,
    max_marks NUMERIC DEFAULT 50,
    evaluation_criteria_id UUID REFERENCES public.evaluation_criteria(id) ON DELETE SET NULL,

    -- Form configuration stored as JSONB (sections, questions, options, etc.)
    form_config JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Audit
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_submission_forms_event_id ON public.project_submission_forms (event_id);
CREATE INDEX IF NOT EXISTS idx_project_submission_forms_round_id ON public.project_submission_forms (round_id);
CREATE INDEX IF NOT EXISTS idx_project_submission_forms_form_status ON public.project_submission_forms (form_status);
CREATE INDEX IF NOT EXISTS idx_project_submission_forms_submission_state ON public.project_submission_forms (submission_state);

-- ------------------------------------------------------------
-- 2. RLS Policies
-- ------------------------------------------------------------

ALTER TABLE public.project_submission_forms ENABLE ROW LEVEL SECURITY;

-- Admins can manage all project submission forms
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_submission_forms' AND policyname = 'Admins can manage project submission forms') THEN
        CREATE POLICY "Admins can manage project submission forms"
            ON public.project_submission_forms FOR ALL
            TO authenticated
            USING (public.is_admin())
            WITH CHECK (public.is_admin());
    END IF;
END $$;

-- Authenticated users can view published forms
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_submission_forms' AND policyname = 'Users can view published project submission forms') THEN
        CREATE POLICY "Users can view published project submission forms"
            ON public.project_submission_forms FOR SELECT
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

-- ------------------------------------------------------------
-- 3. Seed the prebuilt "Project Details & Deliverables" form
-- ------------------------------------------------------------

-- Only insert if not already present (by title)
INSERT INTO public.project_submission_forms (
    id, event_id, round_id, title, description, form_status, submission_state,
    version, timezone, allow_edit_after_submit, allow_resubmission,
    resubmission_policy, auto_lock_at_deadline, allow_member_submit,
    max_marks, form_config, created_by, updated_by, created_at, updated_at
) VALUES (
    '48b77f48-0a54-4dbc-9053-54c46a35c17d',
    '11111111-1111-1111-1111-111111111111',
    '44444444-4444-4444-4444-444444444444',
    'Project Details & Deliverables',
    'Official project submission form for team deliverables. All fields in Section 1 are mandatory. Section 2 contains deliverable links.',
    'draft',
    'not_open',
    1,
    'Asia/Kolkata',
    false, false,
    'none', true, false,
    50,
    '{
      "sections": [
        {
          "id": "bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb",
          "title": "Problem & Solution Statement",
          "description": "Specify the core challenge your project solves and your proposed technical solution. All 4 fields are mandatory.",
          "sort_order": 1,
          "is_required": true,
          "questions": [
            {
              "id": "dddddddd-4444-4444-4444-dddddddddddd",
              "title": "Problem Statement",
              "description": "Specify the core challenge your project solves.",
              "placeholder": "Enter the problem statement",
              "question_type": "short_answer",
              "is_required": true,
              "sort_order": 1,
              "default_value": null,
              "min_chars": null,
              "max_chars": null,
              "min_value": null,
              "max_value": null,
              "max_selections": null,
              "max_file_size": null,
              "max_attachments": 1,
              "allowed_file_types": null,
              "validation_rules": {},
              "conditional_visibility": {},
              "options": []
            },
            {
              "id": "eeeeeeee-5555-5555-5555-eeeeeeeeeeee",
              "title": "Problem Description",
              "description": "Describe the problem in detail.",
              "placeholder": "Enter detailed problem description",
              "question_type": "long_answer",
              "is_required": true,
              "sort_order": 2,
              "default_value": null,
              "min_chars": null,
              "max_chars": null,
              "min_value": null,
              "max_value": null,
              "max_selections": null,
              "max_file_size": null,
              "max_attachments": 1,
              "allowed_file_types": null,
              "validation_rules": {},
              "conditional_visibility": {},
              "options": []
            },
            {
              "id": "ffffffff-6666-6666-6666-ffffffffffff",
              "title": "Proposed Solution",
              "description": "Specify your proposed technical solution.",
              "placeholder": "Enter proposed solution",
              "question_type": "short_answer",
              "is_required": true,
              "sort_order": 3,
              "default_value": null,
              "min_chars": null,
              "max_chars": null,
              "min_value": null,
              "max_value": null,
              "max_selections": null,
              "max_file_size": null,
              "max_attachments": 1,
              "allowed_file_types": null,
              "validation_rules": {},
              "conditional_visibility": {},
              "options": []
            },
            {
              "id": "11111111-7777-7777-7777-111111111111",
              "title": "Solution Description",
              "description": "Describe your solution in detail.",
              "placeholder": "Enter detailed solution description",
              "question_type": "long_answer",
              "is_required": true,
              "sort_order": 4,
              "default_value": null,
              "min_chars": null,
              "max_chars": null,
              "min_value": null,
              "max_value": null,
              "max_selections": null,
              "max_file_size": null,
              "max_attachments": 1,
              "allowed_file_types": null,
              "validation_rules": {},
              "conditional_visibility": {},
              "options": []
            }
          ]
        },
        {
          "id": "cccccccc-3333-3333-3333-cccccccccccc",
          "title": "Canva PPT Link Deliverable",
          "description": "Provide a link to your Canva presentation and other project deliverables.",
          "sort_order": 2,
          "is_required": true,
          "questions": [
            {
              "id": "22222222-8888-8888-8888-222222222222",
              "title": "Canva PPT Link",
              "description": "Provide a link to your Canva presentation. Suggested format: https://www.canva.com/design/...",
              "placeholder": "https://www.canva.com/design/...",
              "question_type": "url",
              "is_required": true,
              "sort_order": 1,
              "default_value": null,
              "min_chars": null,
              "max_chars": null,
              "min_value": null,
              "max_value": null,
              "max_selections": null,
              "max_file_size": null,
              "max_attachments": 1,
              "allowed_file_types": null,
              "validation_rules": {"type": "url"},
              "conditional_visibility": {},
              "options": []
            },
            {
              "id": "33333333-9999-9999-9999-333333333333",
              "title": "GitHub Repository URL",
              "description": "Link to your GitHub repository (optional).",
              "placeholder": "https://github.com/username/repo",
              "question_type": "url",
              "is_required": false,
              "sort_order": 2,
              "default_value": null,
              "min_chars": null,
              "max_chars": null,
              "min_value": null,
              "max_value": null,
              "max_selections": null,
              "max_file_size": null,
              "max_attachments": 1,
              "allowed_file_types": null,
              "validation_rules": {"type": "url"},
              "conditional_visibility": {},
              "options": []
            },
            {
              "id": "44444444-aaaa-aaaa-aaaa-444444444444",
              "title": "Secondary Pitch Deck / Executive Summary URL",
              "description": "Link to your secondary pitch deck or executive summary (optional).",
              "placeholder": "https://...",
              "question_type": "url",
              "is_required": false,
              "sort_order": 3,
              "default_value": null,
              "min_chars": null,
              "max_chars": null,
              "min_value": null,
              "max_value": null,
              "max_selections": null,
              "max_file_size": null,
              "max_attachments": 1,
              "allowed_file_types": null,
              "validation_rules": {"type": "url"},
              "conditional_visibility": {},
              "options": []
            },
            {
              "id": "55555555-bbbb-bbbb-bbbb-555555555555",
              "title": "Live Deployment / Prototype URL",
              "description": "Link to your live deployment or prototype (optional).",
              "placeholder": "https://...",
              "question_type": "url",
              "is_required": false,
              "sort_order": 4,
              "default_value": null,
              "min_chars": null,
              "max_chars": null,
              "min_value": null,
              "max_value": null,
              "max_selections": null,
              "max_file_size": null,
              "max_attachments": 1,
              "allowed_file_types": null,
              "validation_rules": {"type": "url"},
              "conditional_visibility": {},
              "options": []
            },
            {
              "id": "66666666-cccc-cccc-cccc-666666666666",
              "title": "Additional Material / Drive Folder URL",
              "description": "Link to additional materials or Drive folder (optional).",
              "placeholder": "https://drive.google.com/...",
              "question_type": "url",
              "is_required": false,
              "sort_order": 5,
              "default_value": null,
              "min_chars": null,
              "max_chars": null,
              "min_value": null,
              "max_value": null,
              "max_selections": null,
              "max_file_size": null,
              "max_attachments": 1,
              "allowed_file_types": null,
              "validation_rules": {},
              "conditional_visibility": {},
              "options": []
            }
          ]
        }
      ]
    }'::jsonb,
    NULL, NULL, now(), now()
) ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 4. Grant permissions
-- ------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_submission_forms TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- End of migration
