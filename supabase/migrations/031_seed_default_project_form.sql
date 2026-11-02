-- ==============================================================================
-- IVC PULSE: Seed Default "Project Details & Deliverables" Submission Form
-- File: supabase/migrations/031_seed_default_project_form.sql
-- ==============================================================================

-- Default form UUID
-- Form: Project Details & Deliverables
INSERT INTO public.submission_forms (
  id, title, description, event_id, round_id,
  form_status, submission_state,
  submission_open_at, submission_close_at,
  timezone, allow_edit_after_submit, allow_resubmission,
  resubmission_policy, auto_lock_at_deadline, allow_member_submit,
  max_marks, created_by, updated_by, created_at, updated_at
) VALUES (
  'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
  'Project Details & Deliverables',
  'Official project submission form for team deliverables. All fields in Section 1 are mandatory. Section 2 contains deliverable links.',
  '11111111-1111-1111-1111-111111111111',
  '44444444-4444-4444-4444-444444444444',
  'draft', 'not_open',
  NULL, NULL,
  'Asia/Kolkata', false, false,
  'none', true, false,
  NULL, NULL, NULL, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- Section 1: Problem & Solution Statement
INSERT INTO public.form_sections (
  id, form_id, title, description, sort_order, is_required, created_at, updated_at
) VALUES (
  'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb',
  'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
  'Problem & Solution Statement',
  'Specify the core challenge your project solves and your proposed technical solution. All 4 fields are mandatory.',
  1, true, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- Section 2: Canva PPT Link Deliverable
INSERT INTO public.form_sections (
  id, form_id, title, description, sort_order, is_required, created_at, updated_at
) VALUES (
  'cccccccc-3333-3333-3333-cccccccccccc',
  'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
  'Canva PPT Link Deliverable',
  'Provide a link to your Canva presentation and other project deliverables.',
  2, true, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- Section 1 Questions
-- 1. Problem Statement (Short text, Required)
INSERT INTO public.form_questions (
  id, section_id, title, description, placeholder, question_type,
  is_required, sort_order, default_value, min_chars, max_chars,
  min_value, max_value, max_selections, max_file_size, max_attachments,
  allowed_file_types, validation_rules, conditional_visibility, created_at, updated_at
) VALUES (
  'dddddddd-4444-4444-4444-dddddddddddd',
  'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb',
  'Problem Statement',
  'Specify the core challenge your project solves.',
  'Enter the problem statement',
  'short_answer', true, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '{}', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- 2. Problem Description (Long text, Required)
INSERT INTO public.form_questions (
  id, section_id, title, description, placeholder, question_type,
  is_required, sort_order, default_value, min_chars, max_chars,
  min_value, max_value, max_selections, max_file_size, max_attachments,
  allowed_file_types, validation_rules, conditional_visibility, created_at, updated_at
) VALUES (
  'eeeeeeee-5555-5555-5555-eeeeeeeeeeee',
  'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb',
  'Problem Description',
  'Describe the problem in detail.',
  'Enter detailed problem description',
  'long_answer', true, 2, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '{}', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- 3. Proposed Solution (Short text, Required)
INSERT INTO public.form_questions (
  id, section_id, title, description, placeholder, question_type,
  is_required, sort_order, default_value, min_chars, max_chars,
  min_value, max_value, max_selections, max_file_size, max_attachments,
  allowed_file_types, validation_rules, conditional_visibility, created_at, updated_at
) VALUES (
  'ffffffff-6666-6666-6666-ffffffffffff',
  'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb',
  'Proposed Solution',
  'Specify your proposed technical solution.',
  'Enter proposed solution',
  'short_answer', true, 3, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '{}', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- 4. Solution Description (Long text, Required)
INSERT INTO public.form_questions (
  id, section_id, title, description, placeholder, question_type,
  is_required, sort_order, default_value, min_chars, max_chars,
  min_value, max_value, max_selections, max_file_size, max_attachments,
  allowed_file_types, validation_rules, conditional_visibility, created_at, updated_at
) VALUES (
  '11111111-7777-7777-7777-111111111111',
  'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb',
  'Solution Description',
  'Describe your solution in detail.',
  'Enter detailed solution description',
  'long_answer', true, 4, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '{}', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- Section 2 Questions
-- 5. Canva PPT Link (URL, Required, URL validation)
INSERT INTO public.form_questions (
  id, section_id, title, description, placeholder, question_type,
  is_required, sort_order, default_value, min_chars, max_chars,
  min_value, max_value, max_selections, max_file_size, max_attachments,
  allowed_file_types, validation_rules, conditional_visibility, created_at, updated_at
) VALUES (
  '22222222-8888-8888-8888-222222222222',
  'cccccccc-3333-3333-3333-cccccccccccc',
  'Canva PPT Link',
  'Provide a link to your Canva presentation. Suggested format: https://www.canva.com/design/...',
  'https://www.canva.com/design/...',
  'url', true, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{"type": "url"}', '{}', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- 6. GitHub Repository URL (URL, Optional)
INSERT INTO public.form_questions (
  id, section_id, title, description, placeholder, question_type,
  is_required, sort_order, default_value, min_chars, max_chars,
  min_value, max_value, max_selections, max_file_size, max_attachments,
  allowed_file_types, validation_rules, conditional_visibility, created_at, updated_at
) VALUES (
  '33333333-9999-9999-9999-333333333333',
  'cccccccc-3333-3333-3333-cccccccccccc',
  'GitHub Repository URL',
  'Link to your GitHub repository (optional).',
  'https://github.com/username/repo',
  'url', false, 2, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{"type": "url"}', '{}', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- 7. Secondary Pitch Deck / Executive Summary URL (URL, Optional)
INSERT INTO public.form_questions (
  id, section_id, title, description, placeholder, question_type,
  is_required, sort_order, default_value, min_chars, max_chars,
  min_value, max_value, max_selections, max_file_size, max_attachments,
  allowed_file_types, validation_rules, conditional_visibility, created_at, updated_at
) VALUES (
  '44444444-aaaa-aaaa-aaaa-444444444444',
  'cccccccc-3333-3333-3333-cccccccccccc',
  'Secondary Pitch Deck / Executive Summary URL',
  'Link to your secondary pitch deck or executive summary (optional).',
  'https://...',
  'url', false, 3, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{"type": "url"}', '{}', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- 8. Live Deployment / Prototype URL (URL, Optional)
INSERT INTO public.form_questions (
  id, section_id, title, description, placeholder, question_type,
  is_required, sort_order, default_value, min_chars, max_chars,
  min_value, max_value, max_selections, max_file_size, max_attachments,
  allowed_file_types, validation_rules, conditional_visibility, created_at, updated_at
) VALUES (
  '55555555-bbbb-bbbb-bbbb-555555555555',
  'cccccccc-3333-3333-3333-cccccccccccc',
  'Live Deployment / Prototype URL',
  'Link to your live deployment or prototype (optional).',
  'https://...',
  'url', false, 4, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{"type": "url"}', '{}', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- 9. Additional Material / Drive Folder URL (URL, Optional)
INSERT INTO public.form_questions (
  id, section_id, title, description, placeholder, question_type,
  is_required, sort_order, default_value, min_chars, max_chars,
  min_value, max_value, max_selections, max_file_size, max_attachments,
  allowed_file_types, validation_rules, conditional_visibility, created_at, updated_at
) VALUES (
  '66666666-cccc-cccc-cccc-666666666666',
  'cccccccc-3333-3333-3333-cccccccccccc',
  'Additional Material / Drive Folder URL',
  'Link to additional materials or Drive folder (optional).',
  'https://drive.google.com/...',
  'url', false, 5, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '{"type": "url"}', '{}', NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;
