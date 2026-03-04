-- ============================================================
-- Migration 005: Admin Create User RPC
-- Enables Admins to create new users (auth.users + profiles) directly
-- ============================================================

-- pgcrypto functions (crypt, gen_salt) live in 'extensions' schema on Supabase
CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA extensions;

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
BEGIN
  -- 1. Verify that the caller is an Admin
  SELECT count(*) INTO v_admin_count
  FROM public.profiles
  WHERE id = auth.uid() AND role = 'admin';

  IF v_admin_count = 0 THEN
    RAISE EXCEPTION 'Only administrators can create new users.';
  END IF;

  -- 2. Generate a new UUID for the user
  v_user_id := gen_random_uuid();

  -- 3. Insert into auth.users
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

  -- 4. The `on_auth_user_created` trigger will automatically create a profile in `public.profiles`
  -- But it creates it with 'viewer' role by default. Let's update it to the requested role.
  UPDATE public.profiles
  SET role = p_role,
      full_name = p_full_name
  WHERE id = v_user_id;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions;

-- Grant execution to authenticated users (the function internally checks for admin role)
GRANT EXECUTE ON FUNCTION admin_create_user TO authenticated;
