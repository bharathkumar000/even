-- ==============================================================================
-- 030_activity_form_integration.sql
-- Link submission forms to content release activities
-- ==============================================================================

-- Add activity_id to submission_forms to link forms to content hub activities
ALTER TABLE public.submission_forms
ADD COLUMN IF NOT EXISTS activity_id UUID REFERENCES public.problem_statements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_submission_forms_activity_id ON public.submission_forms (activity_id);

-- RLS: admins can already manage submission_forms (existing policy from migration 024)
-- No new RLS needed since activity_id is just a foreign key reference

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.submission_forms TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- End of migration
