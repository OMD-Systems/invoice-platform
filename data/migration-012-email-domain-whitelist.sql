-- ============================================================
-- Migration 012: Email Domain Whitelist
-- Restricts user creation to approved email domains
-- ============================================================

-- 1. Whitelist table
CREATE TABLE IF NOT EXISTS public.allowed_email_domains (
  domain TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: only admins can manage, all authenticated can read
ALTER TABLE public.allowed_email_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read allowed domains"
  ON public.allowed_email_domains FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage allowed domains"
  ON public.allowed_email_domains FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 2. Seed initial domain
INSERT INTO public.allowed_email_domains (domain)
VALUES ('omdsystems.com')
ON CONFLICT DO NOTHING;

-- 3. RPC to fetch allowed domains (for UI)
CREATE OR REPLACE FUNCTION get_allowed_domains()
RETURNS SETOF TEXT AS $$
  SELECT domain FROM public.allowed_email_domains ORDER BY domain;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_allowed_domains TO authenticated;

-- 4. Update admin_create_user — add domain check
CREATE OR REPLACE FUNCTION admin_create_user(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_role TEXT
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_admin_count INT;
  v_email_domain TEXT;
  v_domain_allowed BOOLEAN;
BEGIN
  -- 1. Verify that the caller is an Admin
  SELECT count(*) INTO v_admin_count
  FROM public.profiles
  WHERE id = auth.uid() AND role = 'admin';

  IF v_admin_count = 0 THEN
    RAISE EXCEPTION 'Only administrators can create new users.';
  END IF;

  -- 2. Extract and validate email domain
  v_email_domain := split_part(lower(trim(p_email)), '@', 2);

  IF v_email_domain = '' OR v_email_domain IS NULL THEN
    RAISE EXCEPTION 'Invalid email address.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.allowed_email_domains WHERE domain = v_email_domain
  ) INTO v_domain_allowed;

  IF NOT v_domain_allowed THEN
    RAISE EXCEPTION 'Email domain "%" is not allowed. Contact an administrator to add it.', v_email_domain;
  END IF;

  -- 3. Generate a new UUID for the user
  v_user_id := gen_random_uuid();

  -- 4. Insert into auth.users
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name),
    now(), now()
  );

  -- 5. Insert into auth.identities (required for GoTrue v2 / signInWithOtp)
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_user_id, v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', p_email, 'email_verified', true),
    'email', p_email, now(), now(), now()
  );

  -- 6. The `on_auth_user_created` trigger will automatically create a profile in `public.profiles`
  -- But it creates it with 'viewer' role by default. Let's update it to the requested role.
  UPDATE public.profiles
  SET role = p_role,
      full_name = p_full_name
  WHERE id = v_user_id;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions;

GRANT EXECUTE ON FUNCTION admin_create_user TO authenticated;
