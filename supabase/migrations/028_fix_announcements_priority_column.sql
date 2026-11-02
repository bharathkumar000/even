-- ==============================================================================
-- 028_fix_announcements_priority_column.sql
-- Ensures priority_level column exists on announcements table.
-- Migration 017 added priority_level but may not have been applied to all
-- environments. This migration is idempotent and safe to re-run.
-- ==============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'announcements'
          AND column_name = 'priority_level'
    ) THEN
        ALTER TABLE public.announcements
            ADD COLUMN priority_level TEXT NOT NULL DEFAULT 'normal'
                CHECK (priority_level IN ('normal', 'important', 'high', 'urgent'));
    END IF;
END $$;

-- Ensure the constraint exists even if column was added without it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.announcements'::regclass
          AND conname = 'announcements_priority_level_check'
    ) THEN
        ALTER TABLE public.announcements
            ADD CONSTRAINT announcements_priority_level_check
                CHECK (priority_level IN ('normal', 'important', 'high', 'urgent'));
    END IF;
END $$;

-- Index for priority-based filtering
CREATE INDEX IF NOT EXISTS idx_announcements_priority_level ON public.announcements (priority_level);

-- End of migration
