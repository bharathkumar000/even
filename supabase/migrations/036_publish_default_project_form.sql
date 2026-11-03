-- ==============================================================================
-- 036_publish_default_project_form.sql
-- Publish the prebuilt "Project Details & Deliverables" form so it is visible
-- to team leaders in the Team Portal.
-- ==============================================================================

UPDATE public.project_submission_forms
SET form_status = 'published',
    submission_state = 'open',
    updated_at = now()
WHERE title = 'Project Details & Deliverables'
  AND form_status = 'draft';

-- End of migration
