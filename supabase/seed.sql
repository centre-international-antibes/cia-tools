-- Seed: local development admin user
-- Email: admin@cia-tools.local / Password: Admin123!

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
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'admin@cia-tools.local',
  crypt('Admin123!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Admin CIA"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
);

INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'admin@cia-tools.local',
  jsonb_build_object('sub', '00000000-0000-0000-0000-000000000001', 'email', 'admin@cia-tools.local'),
  'email',
  now(),
  now(),
  now()
);

-- Promote to admin
UPDATE public.profiles
SET role = 'admin', scopes = '{relance_ats}'
WHERE id = '00000000-0000-0000-0000-000000000001';
