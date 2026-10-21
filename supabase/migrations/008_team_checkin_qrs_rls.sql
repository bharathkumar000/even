-- 008_team_checkin_qrs_rls.sql
-- Enable row‑level security and allow only members of a team to read that
-- team's QR record.

alter table public.team_checkin_qrs enable row level security;

create policy "team members can read own QR"
  on public.team_checkin_qrs
  for select
  using (
    auth.uid() = (
      select tm.user_id
      from team_members tm
      join teams t on tm.team_id = t.id
      where t.code = team_checkin_qrs.team_code
      limit 1
    )
  );
