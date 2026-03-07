-- Migration 022: Avatar Storage (bucket + RLS + RPC)
-- Run in Supabase SQL Editor

-- 1. Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- 2. RLS policies for avatars bucket

-- Upload: authenticated users can upload to their own folder
CREATE POLICY "avatar_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Update: authenticated users can update their own avatar
CREATE POLICY "avatar_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Delete: authenticated users can delete their own avatar
CREATE POLICY "avatar_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Read: public access (avatars are public)
CREATE POLICY "avatar_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');

-- 3. RPC to update avatar_url on employee record
CREATE OR REPLACE FUNCTION update_my_avatar(p_avatar_url TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE employees
  SET avatar_url = p_avatar_url,
      updated_at = NOW()
  WHERE work_email = v_email;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION update_my_avatar(TEXT) TO authenticated;
