-- 010_add_social_media_to_teams.sql
-- Add social media and website columns to teams table for QR badge display.
-- Non-destructive: adds nullable columns only.

alter table public.teams add column if not exists linkedin_url text;
alter table public.teams add column if not exists instagram_url text;
alter table public.teams add column if not exists twitter_url text;
alter table public.teams add column if not exists website_url text;
