-- ==============================================================================
-- IVC PULSE: High-Concurrency Performance Indexes
-- Migration: 043_performance_indexes.sql
--
-- Purpose:
--   Dramatically accelerate lookups for high-traffic event operations:
--   1. Team & Participant duplicate scan checks (sub-2ms lookups)
--   2. Scanner live activity feeds & recent scan histories
--   3. Team member roster lookups during badge scanning
-- ==============================================================================

-- 1. Fast compound lookup for duplicate claim checks by team + action + result
CREATE INDEX IF NOT EXISTS idx_activity_logs_team_action_result
  ON public.event_activity_logs (team_id, action_type, result);

-- 2. Fast compound lookup for participant-specific claim checks
CREATE INDEX IF NOT EXISTS idx_activity_logs_participant_action_result
  ON public.event_activity_logs (participant_id, action_type, result);

-- 3. Fast ordering index for live scanner audit feed & recently scanned queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at_desc
  ON public.event_activity_logs (created_at DESC);

-- 4. Fast lookup for team members during scanner roster population
CREATE INDEX IF NOT EXISTS idx_team_members_team_id
  ON public.team_members (team_id);

CREATE INDEX IF NOT EXISTS idx_team_members_user_id
  ON public.team_members (user_id);

-- 5. Fast team code lookup for badge manual search and resolution
CREATE INDEX IF NOT EXISTS idx_teams_code
  ON public.teams (code);

-- 6. Supporting index for team registrations status filtering
CREATE INDEX IF NOT EXISTS idx_team_registrations_status_created
  ON public.team_registrations (status, created_at DESC);

