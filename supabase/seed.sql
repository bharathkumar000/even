-- ==============================================================================
-- IVC PULSE: Seed Data for Instant System Testing & Auth Profiles
-- File: supabase/seed.sql
-- ==============================================================================

-- 1. Sample Event
INSERT INTO public.events (id, title, description) 
VALUES ('11111111-1111-1111-1111-111111111111', 'IVC Hackathon 2026', 'Annual Flagship Hackathon')
ON CONFLICT (id) DO NOTHING;

-- 2. Sample Teams
INSERT INTO public.teams (id, event_id, name, code, track, leader_name, status) VALUES
('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Alpha Coders', 'TEAM-ALPHA', 'AI & Web3', 'Team Leader Mike', 'active'),
('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Beta Builders', 'TEAM-BETA', 'Open Innovation', 'Alex Chen', 'active')
ON CONFLICT (id) DO NOTHING;

-- 3. Sample Round & Criteria
INSERT INTO public.evaluation_rounds (id, event_id, title, sequence_order, status) VALUES
('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Round 1: Innovation & Pitch', 1, 'open')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.evaluation_criteria (round_id, title, description, max_marks, is_required) VALUES
('44444444-4444-4444-4444-444444444444', 'Innovation', 'Uniqueness of idea', 10, true),
('44444444-4444-4444-4444-444444444444', 'Technical Execution', 'Quality of codebase', 10, true)
ON CONFLICT DO NOTHING;

-- 4. Test User Accounts (auth.users + public.profiles)
-- Password for all test accounts: Password123!
-- Encrypted password hash created with pgcrypto extension for 'Password123!'
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    phone_change,
    phone_change_token,
    email_change_token_current,
    reauthentication_token
) VALUES 
-- 4.1 Admin User
(
    'a1111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin@ivc.com',
    crypt('Password123!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Admin User","role":"admin"}',
    now(),
    now(),
    '', '', '', '', '', '', '', ''
),
-- 4.2 Judge User
(
    'a2222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'judge@ivc.com',
    crypt('Password123!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Judge Sarah","role":"judge"}',
    now(),
    now(),
    '', '', '', '', '', '', '', ''
),
-- 4.3 Team Leader User
(
    'a3333333-3333-3333-3333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'leader@ivc.com',
    crypt('Password123!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Team Leader Mike","role":"participant"}',
    now(),
    now(),
    '', '', '', '', '', '', '', ''
),
-- 4.4 Staff / Operations User
(
    'a4444444-4444-4444-4444-444444444444',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'staff@ivc.com',
    crypt('Password123!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Operations Staff","role":"staff"}',
    now(),
    now(),
    '', '', '', '', '', '', '', ''
)
ON CONFLICT (id) DO NOTHING;

-- Repair any existing users with NULL tokens to prevent GoTrue scanning 500 error
UPDATE auth.users
SET 
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change = COALESCE(email_change, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  reauthentication_token = COALESCE(reauthentication_token, '')
WHERE 
  confirmation_token IS NULL
  OR recovery_token IS NULL
  OR email_change_token_new IS NULL
  OR email_change IS NULL
  OR phone_change IS NULL
  OR phone_change_token IS NULL
  OR email_change_token_current IS NULL
  OR reauthentication_token IS NULL;

-- 5. Explicitly Assign Profile Roles
INSERT INTO public.profiles (id, email, full_name, role) VALUES
('a1111111-1111-1111-1111-111111111111', 'admin@ivc.com', 'Admin User', 'admin'),
('a2222222-2222-2222-2222-222222222222', 'judge@ivc.com', 'Judge Sarah', 'judge'),
('a3333333-3333-3333-3333-333333333333', 'leader@ivc.com', 'Team Leader Mike', 'participant'),
('a4444444-4444-4444-4444-444444444444', 'staff@ivc.com', 'Operations Staff', 'staff')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, full_name = EXCLUDED.full_name;

-- 6. Team Leader Assignment to Sample Team
INSERT INTO public.team_members (team_id, user_id, role) VALUES
('22222222-2222-2222-2222-222222222222', 'a3333333-3333-3333-3333-333333333333', 'leader')
ON CONFLICT (team_id, user_id) DO UPDATE SET role = 'leader';

-- 7. Judge Assignment to Sample Team
INSERT INTO public.judge_assignments (judge_id, team_id, round_id) VALUES
('a2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444')
ON CONFLICT (judge_id, team_id, round_id) DO UPDATE SET round_id = EXCLUDED.round_id;
