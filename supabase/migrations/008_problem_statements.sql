-- ==============================================================================
-- Problem Statements table for Content Release Manager
-- ==============================================================================

-- Enum for content status
DO $$ BEGIN
    CREATE TYPE content_status AS ENUM ('draft', 'published', 'unpublished');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Table definition
CREATE TABLE IF NOT EXISTS public.problem_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_number TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    domain TEXT,
    summary TEXT,
    description TEXT NOT NULL,
    objectives TEXT,
    deliverables TEXT,
    constraints TEXT,
    evaluation_criteria TEXT,
    resource_links JSONB,
    attachments JSONB,
    display_order INT DEFAULT 0,
    status content_status NOT NULL DEFAULT 'draft',
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    published_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS problem_statements_status_idx ON public.problem_statements (status);
CREATE INDEX IF NOT EXISTS problem_statements_domain_idx ON public.problem_statements (domain);
CREATE INDEX IF NOT EXISTS problem_statements_display_order_idx ON public.problem_statements (display_order);

-- Enable row level security
ALTER TABLE public.problem_statements ENABLE ROW LEVEL SECURITY;

-- Policies
-- Admins can manage all fields
CREATE POLICY "Admins can manage problem statements"
    ON public.problem_statements
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Authenticated users can read only published problem statements
CREATE POLICY "Authenticated users can read published problem statements"
    ON public.problem_statements
    FOR SELECT TO authenticated
    USING (status = 'published');
