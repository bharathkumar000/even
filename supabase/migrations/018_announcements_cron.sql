-- ==============================================================================
-- 018_announcements_cron.sql
-- Supabase pg_cron job configuration for announcements scheduler
-- ==============================================================================

-- Enable pg_cron extension (run as superuser in Supabase Dashboard SQL Editor)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the announcement processor to run every minute
-- This will process pending publications, expirations, and unpublishes
SELECT cron.schedule(
  'process-announcements-scheduler',
  '* * * * *', -- Every minute
  $$
  SELECT public.process_scheduled_announcements();
  $$
);

-- Optional: Schedule cleanup of old completed/failed schedules (daily at 2 AM)
SELECT cron.schedule(
  'cleanup-announcement-schedules',
  '0 2 * * *', -- Daily at 2 AM
  $$
  DELETE FROM public.announcement_schedules
  WHERE status IN ('completed', 'failed', 'cancelled')
    AND updated_at < now() - interval '30 days';
  $$
);

-- Optional: Schedule cleanup of old audit logs (weekly on Sunday at 3 AM)
SELECT cron.schedule(
  'cleanup-announcements-audit',
  '0 3 * * 0', -- Weekly on Sunday at 3 AM
  $$
  DELETE FROM public.announcements_audit
  WHERE created_at < now() - interval '90 days';
  $$