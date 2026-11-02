-- ==============================================================================
-- IVC PULSE: Performance Indexes Migration
-- File: supabase/migrations/026_performance_indexes.sql
-- ==============================================================================
-- Adds missing indexes for frequently queried columns across portal pages.
-- These indexes target the slowest queries identified in the performance audit.

-- ------------------------------------------------------------------------------
-- 1. PROFILES TABLE INDEXES
-- ------------------------------------------------------------------------------
-- Role-based lookups (auth checks, admin verification)
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
-- Email lookups (user resolution)
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
-- Created_at ordering (recent users)
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);

-- ------------------------------------------------------------------------------
-- 2. TEAMS TABLE INDEXES
-- ------------------------------------------------------------------------------
-- Track filtering (team dashboard filters)
CREATE INDEX IF NOT EXISTS idx_teams_track ON public.teams(track);
-- Status filtering
CREATE INDEX IF NOT EXISTS idx_teams_status ON public.teams(status);
-- Leader name lookups
CREATE INDEX IF NOT EXISTS idx_teams_leader_name ON public.teams(leader_name);
-- Event association
CREATE INDEX IF NOT EXISTS idx_teams_event_id ON public.teams(event_id);

-- ------------------------------------------------------------------------------
-- 3. TEAM MEMBERS TABLE INDEXES
-- ------------------------------------------------------------------------------
-- User's team membership (dashboard lookups)
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);
-- Team's members (roster lookups)
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members(team_id);
-- Role filtering (leaders vs members)
CREATE INDEX IF NOT EXISTS idx_team_members_role ON public.team_members(role);
-- Composite for common dashboard query: team_id + user_id
CREATE INDEX IF NOT EXISTS idx_team_members_team_user ON public.team_members(team_id, user_id);

-- ------------------------------------------------------------------------------
-- 4. ANNOUNCEMENTS TABLE INDEXES
-- ------------------------------------------------------------------------------
-- Status filtering (admin dashboard, portal filtering)
CREATE INDEX IF NOT EXISTS idx_announcements_status ON public.announcements(status);
-- Active flag (portal visibility)
CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON public.announcements(is_active);
-- Target audience (portal filtering)
CREATE INDEX IF NOT EXISTS idx_announcements_target_audience ON public.announcements(target_audience);
-- Array audience (multi-audience filtering via GIN)
CREATE INDEX IF NOT EXISTS idx_announcements_target_audiences ON public.announcements USING GIN (target_audiences);
-- Expiry filtering
CREATE INDEX IF NOT EXISTS idx_announcements_expires_at ON public.announcements(expires_at);
-- Created_at ordering
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements(created_at DESC);
-- Published_at ordering
CREATE INDEX IF NOT EXISTS idx_announcements_published_at ON public.announcements(published_at DESC NULLS LAST);
-- Pin-to-top ordering
CREATE INDEX IF NOT EXISTS idx_announcements_pin_to_top ON public.announcements(pin_to_top DESC);
-- Composite: status + is_active (most common portal query)
CREATE INDEX IF NOT EXISTS idx_announcements_status_active ON public.announcements(status, is_active);
-- Composite: target_audience + is_active
CREATE INDEX IF NOT EXISTS idx_announcements_audience_active ON public.announcements(target_audience, is_active);

-- ------------------------------------------------------------------------------
-- 5. TEAM SPOC ASSIGNMENTS TABLE INDEXES
-- ------------------------------------------------------------------------------
-- SPOC's assigned teams (staff dashboard - critical)
CREATE INDEX IF NOT EXISTS idx_team_spoc_assignments_spoc_id ON public.team_spoc_assignments(spoc_id);
-- Team's SPOC assignment (team page lookup)
CREATE INDEX IF NOT EXISTS idx_team_spoc_assignments_team_id ON public.team_spoc_assignments(team_id);
-- Allotted_at ordering
CREATE INDEX IF NOT EXISTS idx_team_spoc_assignments_allotted_at ON public.team_spoc_assignments(allotted_at DESC);

-- ------------------------------------------------------------------------------
-- 6. SPOCS TABLE INDEXES
-- ------------------------------------------------------------------------------
-- Staff link (SPOC resolution from profile)
CREATE INDEX IF NOT EXISTS idx_spocs_staff_id ON public.spocs(staff_id);
-- Department filtering
CREATE INDEX IF NOT EXISTS idx_spocs_department ON public.spocs(department);

-- ------------------------------------------------------------------------------
-- 7. TEAM SUBMISSIONS TABLE INDEXES
-- ------------------------------------------------------------------------------
-- Team's submissions (dashboard lookup)
CREATE INDEX IF NOT EXISTS idx_team_submissions_team_id ON public.team_submissions(team_id);
-- Round's submissions (judge dashboard)
CREATE INDEX IF NOT EXISTS idx_team_submissions_round_id ON public.team_submissions(round_id);
-- Composite: team_id + round_id (already unique, but explicit for query planner)
CREATE INDEX IF NOT EXISTS idx_team_submissions_team_round ON public.team_submissions(team_id, round_id);
-- Created_at ordering
CREATE INDEX IF NOT EXISTS idx_team_submissions_created_at ON public.team_submissions(created_at DESC);

-- ------------------------------------------------------------------------------
-- 8. EVENT RESULTS TABLE INDEXES
-- ------------------------------------------------------------------------------
-- Team's results (dashboard lookup)
CREATE INDEX IF NOT EXISTS idx_event_results_team_id ON public.event_results(team_id);
-- Published results filtering
CREATE INDEX IF NOT EXISTS idx_event_results_is_published ON public.event_results(is_published);
-- Event's results
CREATE INDEX IF NOT EXISTS idx_event_results_event_id ON public.event_results(event_id);
-- Composite: team_id + is_published
CREATE INDEX IF NOT EXISTS idx_event_results_team_published ON public.event_results(team_id, is_published);
-- Rank ordering
CREATE INDEX IF NOT EXISTS idx_event_results_rank ON public.event_results(rank);

-- ------------------------------------------------------------------------------
-- 9. EVALUATION ROUNDS TABLE INDEXES
-- ------------------------------------------------------------------------------
-- Status filtering (active/open rounds)
CREATE INDEX IF NOT EXISTS idx_evaluation_rounds_status ON public.evaluation_rounds(status);
-- Sequence ordering
CREATE INDEX IF NOT EXISTS idx_evaluation_rounds_sequence_order ON public.evaluation_rounds(sequence_order);
-- Event's rounds
CREATE INDEX IF NOT EXISTS idx_evaluation_rounds_event_id ON public.evaluation_rounds(event_id);
-- Composite: status + sequence_order (active round query)
CREATE INDEX IF NOT EXISTS idx_evaluation_rounds_status_seq ON public.evaluation_rounds(status, sequence_order);

-- ------------------------------------------------------------------------------
-- 10. EVALUATIONS TABLE INDEXES
-- ------------------------------------------------------------------------------
-- Round's evaluations
CREATE INDEX IF NOT EXISTS idx_evaluations_round_id ON public.evaluations(round_id);
-- Team's evaluations
CREATE INDEX IF NOT EXISTS idx_evaluations_team_id ON public.evaluations(team_id);
-- Judge's evaluations
CREATE INDEX IF NOT EXISTS idx_evaluations_judge_id ON public.evaluations(judge_id);
-- Composite: round_id + team_id + judge_id (already unique)
CREATE INDEX IF NOT EXISTS idx_evaluations_round_team_judge ON public.evaluations(round_id, team_id, judge_id);
-- Status filtering
CREATE INDEX IF NOT EXISTS idx_evaluations_status ON public.evaluations(status);

-- ------------------------------------------------------------------------------
-- 11. JUDGE ASSIGNMENTS TABLE INDEXES
-- ------------------------------------------------------------------------------
-- Judge's assignments
CREATE INDEX IF NOT EXISTS idx_judge_assignments_judge_id ON public.judge_assignments(judge_id);
-- Team's assignments
CREATE INDEX IF NOT EXISTS idx_judge_assignments_team_id ON public.judge_assignments(team_id);

-- ------------------------------------------------------------------------------
-- 12. EVENT ACTIVITY LOGS TABLE INDEXES
-- ------------------------------------------------------------------------------
-- Team's activity logs (dashboard counters)
CREATE INDEX IF NOT EXISTS idx_event_activity_logs_team_id ON public.event_activity_logs(team_id);
-- Participant's activity logs
CREATE INDEX IF NOT EXISTS idx_event_activity_logs_participant_id ON public.event_activity_logs(participant_id);
-- Action type filtering
CREATE INDEX IF NOT EXISTS idx_event_activity_logs_action_type ON public.event_activity_logs(action_type);
-- Created_at ordering
CREATE INDEX IF NOT EXISTS idx_event_activity_logs_created_at ON public.event_activity_logs(created_at DESC);
-- Composite: team_id + action_type (dashboard counter query)
CREATE INDEX IF NOT EXISTS idx_event_activity_logs_team_action ON public.event_activity_logs(team_id, action_type);

-- ------------------------------------------------------------------------------
-- 13. CONTENT HUB TABLE INDEXES
-- ------------------------------------------------------------------------------
-- Status filtering
CREATE INDEX IF NOT EXISTS idx_content_hub_status ON public.content_hub(status);
-- Content type filtering
CREATE INDEX IF NOT EXISTS idx_content_hub_content_type ON public.content_hub(content_type);
-- Category filtering
CREATE INDEX IF NOT EXISTS idx_content_hub_category ON public.content_hub(category);
-- Target audiences (GIN for array overlap)
CREATE INDEX IF NOT EXISTS idx_content_hub_target_audiences ON public.content_hub USING GIN (target_audiences);
-- Created_at ordering
CREATE INDEX IF NOT EXISTS idx_content_hub_created_at ON public.content_hub(created_at DESC);
-- Pin-to-top ordering
CREATE INDEX IF NOT EXISTS idx_content_hub_pin_to_top ON public.content_hub(pin_to_top DESC);
-- Composite: status + created_at
CREATE INDEX IF NOT EXISTS idx_content_hub_status_created ON public.content_hub(status, created_at DESC);

-- ------------------------------------------------------------------------------
-- 14. CONTENT HUB SCHEDULES TABLE INDEXES
-- ------------------------------------------------------------------------------
-- Content's schedules
CREATE INDEX IF NOT EXISTS idx_content_hub_schedules_content_id ON public.content_hub_schedules(content_id);
-- Status filtering
CREATE INDEX IF NOT EXISTS idx_content_hub_schedules_status ON public.content_hub_schedules(status);
-- Scheduled_at ordering
CREATE INDEX IF NOT EXISTS idx_content_hub_schedules_scheduled_at ON public.content_hub_schedules(scheduled_at);
-- Composite: content_id + status
CREATE INDEX IF NOT EXISTS idx_content_hub_schedules_content_status ON public.content_hub_schedules(content_id, status);

-- ------------------------------------------------------------------------------
-- 15. EVALUATION CRITERIA TABLE INDEXES
-- ------------------------------------------------------------------------------
-- Round's criteria
CREATE INDEX IF NOT EXISTS idx_evaluation_criteria_round_id ON public.evaluation_criteria(round_id);

-- ------------------------------------------------------------------------------
-- 16. JUDGE CONFLICTS TABLE INDEXES
-- ------------------------------------------------------------------------------
-- Judge's conflicts
CREATE INDEX IF NOT EXISTS idx_judge_conflicts_judge_id ON public.judge_conflicts(judge_id);
-- Team's conflicts
CREATE INDEX IF NOT EXISTS idx_judge_conflicts_team_id ON public.judge_conflicts(team_id);

-- ------------------------------------------------------------------------------
-- 17. AUDIT LOGS TABLE INDEXES
-- ------------------------------------------------------------------------------
-- Admin's audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON public.audit_logs(admin_id);
-- Created_at ordering
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ------------------------------------------------------------------------------
-- 18. SUBMISSION REVISIONS TABLE INDEXES
-- ------------------------------------------------------------------------------
-- Submission's revisions
CREATE INDEX IF NOT EXISTS idx_submission_revisions_submission_id ON public.submission_revisions(submission_id);
-- Team's revisions
CREATE INDEX IF NOT EXISTS idx_submission_revisions_team_id ON public.submission_revisions(team_id);

-- ------------------------------------------------------------------------------
-- 19. ENABLE REALTIME PUBLICATION FOR NEWLY INDEXED TABLES
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Announcements (may already be added)
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'announcements'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
    END IF;

    -- Content hub
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'content_hub'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.content_hub;
    END IF;

    -- Team spoc assignments
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'team_spoc_assignments'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.team_spoc_assignments;
    END IF;

    -- Spocs
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'spocs'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.spocs;
    END IF;

    -- Teams
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'teams'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
    END IF;

    -- Team members
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'team_members'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;
    END IF;

    -- Team submissions
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'team_submissions'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.team_submissions;
    END IF;

    -- Event results
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'event_results'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.event_results;
    END IF;

    -- Evaluation rounds
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'evaluation_rounds'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.evaluation_rounds;
    END IF;

    -- Event activity logs
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'event_activity_logs'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.event_activity_logs;
    END IF;
  END IF;
END $$;

-- End of migration
