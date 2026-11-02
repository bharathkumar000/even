/**
 * Create the Team Project Submission Form in Supabase
 * Run this in the Supabase SQL Editor
 */

-- First, find an active evaluation round
-- Replace the round_id below with an actual round ID from your database
-- You can find rounds by running: SELECT id, title, sequence_order, status FROM evaluation_rounds;

-- Step 1: Create the submission form
INSERT INTO public.submission_forms (
    title,
    description,
    round_id,
    form_status,
    submission_state,
    timezone,
    allow_early_view,
    allow_draft_before_open,
    allow_edit_after_submit,
    allow_resubmission,
    resubmission_policy,
    auto_lock_at_deadline,
    allow_member_submit,
    max_marks,
    created_by,
    updated_by,
    created_at,
    updated_at
) VALUES (
    'Team Project Submission Form',
    'Submit your project deliverables including presentation, technical documentation, prototype evidence, and final declaration.',
    -- REPLACE WITH YOUR ACTUAL ROUND ID:
    '7be84c71-8e1f-486e-9832-ed51363bb77c',  -- <-- UPDATE THIS
    'published',
    'open',
    'Asia/Kolkata',
    false,
    false,
    true,
    true,
    'until_deadline',
    true,
    true,
    100,
    '00000000-0000-0000-0000-000000000000', -- System user
    '00000000-0000-0000-0000-000000000000',
    now(),
    now()
)
RETURNING id;

-- Step 2: Create sections and questions
-- Run this AFTER step 1, using the returned form ID
-- Replace 'FORM_ID_HERE' with the actual form ID from step 1

/*
-- Section 1: Project Identification
INSERT INTO public.form_sections (form_id, title, description, sort_order, is_required, created_at, updated_at)
VALUES ('FORM_ID_HERE', 'Project Identification', 'Basic project information', 1, true, now(), now())
RETURNING id;

-- Then for each question in section 1:
INSERT INTO public.form_questions (section_id, title, description, question_type, is_required, sort_order, default_value, min_chars, max_chars, min_value, max_value, max_selections, max_file_size, max_attachments, allowed_file_types, validation_rules, conditional_visibility, created_at, updated_at)
VALUES ('SECTION_ID_HERE', 'Project Title', 'The official title of your project', 'short_answer', true, 1, null, null, null, null, null, null, null, null, '{}'::jsonb, '{}'::jsonb, now(), now());

-- Repeat for each question...

-- Section 2: Presentation Deliverable
INSERT INTO public.form_sections (form_id, title, description, sort_order, is_required, created_at, updated_at)
VALUES ('FORM_ID_HERE', 'Presentation Deliverable', 'Presentation and documentation links', 2, true, now(), now())
RETURNING id;

-- Section 3: Prototype & Implementation Evidence
INSERT INTO public.form_sections (form_id, title, description, sort_order, is_required, created_at, updated_at)
VALUES ('FORM_ID_HERE', 'Prototype & Implementation Evidence', 'Proof of your working prototype', 3, true, now(), now())
RETURNING id;

-- Section 4: Final Declaration
INSERT INTO public.form_sections (form_id, title, description, sort_order, is_required, created_at, updated_at)
VALUES ('FORM_ID_HERE', 'Final Declaration', 'Declaration of originality', 4, true, now(), now())
RETURNING id;
*/

-- To find your round ID, run:
-- SELECT id, title, sequence_order, status FROM evaluation_rounds ORDER BY sequence_order LIMIT 1;

-- To see existing forms:
-- SELECT id, title, form_status, submission_state, round_id FROM submission_forms ORDER BY created_at DESC;
