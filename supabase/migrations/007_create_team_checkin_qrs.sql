-- 007_create_team_checkin_qrs.sql
-- Create table to store static check‑in QR records per team.
-- Each team is identified by its unique `team_code` (the value used in
-- registrations and QR generation).

create table public.team_checkin_qrs (
  team_code   text primary key,
  qr_token    text not null,
  qr_url      text not null,
  updated_at  timestamptz default now()
);
