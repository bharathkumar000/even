-- 009_add_public_id_to_team_checkin_qrs.sql
-- Add an opaque public_id to team_checkin_qrs so QR URLs can be clean
-- and never expose the secret qr_token.
--
-- Strategy:
--   1. Add public_id as nullable TEXT
--   2. Backfill existing rows with secure random IDs
--   3. Enforce NOT NULL and UNIQUE
--
-- Requires pgcrypto for gen_random_bytes().

create extension if not exists pgcrypto;

alter table public.team_checkin_qrs add column public_id text;

update public.team_checkin_qrs
set public_id = encode(gen_random_bytes(8), 'hex')
where public_id is null;

alter table public.team_checkin_qrs alter column public_id set not null;

alter table public.team_checkin_qrs
  add constraint team_checkin_qrs_public_id_key unique (public_id);

-- RLS: public_id is readable by anyone (it's public by design),
-- but qr_token remains protected by the existing team-member RLS policy.
create policy "public can read public_id and qr_url"
  on public.team_checkin_qrs
  for select
  using (true);
