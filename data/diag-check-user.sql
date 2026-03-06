-- Diagnostic: check user oksana@omdsystems.com
-- Run in Supabase SQL Editor to find the issue

-- 1. Does the user exist in auth.users?
SELECT id, email, email_confirmed_at, created_at, updated_at, last_sign_in_at,
       raw_app_meta_data, banned_until, deleted_at
FROM auth.users
WHERE email = 'oksana@omdsystems.com';

-- 2. Does the user have a valid identity record?
SELECT i.id, i.user_id, i.provider, i.provider_id, i.created_at, i.updated_at
FROM auth.identities i
JOIN auth.users u ON u.id = i.user_id
WHERE u.email = 'oksana@omdsystems.com';

-- 3. Is there an OTP rate limit lock?
SELECT * FROM otp_rate_limits WHERE email = 'oksana@omdsystems.com';

-- 4. Does the user have a profile?
SELECT p.id, p.email, p.full_name, p.role
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'oksana@omdsystems.com';

-- 5. Are there any Auth Hooks configured? (check pg_net or vault-related)
SELECT * FROM auth.flow_state WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'oksana@omdsystems.com'
);

-- 6. Check if any custom hooks exist (Supabase stores them in auth.hooks if using DB hooks)
-- This table may not exist on all Supabase versions
-- SELECT * FROM auth.hooks;

-- ═══ FIXES ═══

-- FIX A: If identity record is MISSING, recreate it:
/*
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
SELECT
  u.id, u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', u.email, now(), u.created_at, now()
FROM auth.users u
WHERE u.email = 'oksana@omdsystems.com'
  AND NOT EXISTS (
    SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'email'
  );
*/

-- FIX B: If OTP rate limit is stuck, clear it:
-- DELETE FROM otp_rate_limits WHERE email = 'oksana@omdsystems.com';

-- FIX C: If user is banned/deleted, unban:
-- UPDATE auth.users SET banned_until = NULL, deleted_at = NULL WHERE email = 'oksana@omdsystems.com';
