-- ============================================================
-- Migration 002: Fix infinite recursion in profiles RLS
-- Problem: policies on profiles reference profiles → infinite loop
-- Solution: SECURITY DEFINER function + clean policies
-- Run in Supabase SQL Editor (one-time)
-- ============================================================

-- 1. Create a SECURITY DEFINER function to get current user's role
--    This bypasses RLS, so no recursion
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- 2. Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

-- 3. Drop ALL existing policies on profiles to clean up recursion
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

-- 4. Create clean, non-recursive policies
-- All authenticated users can read all profiles (needed for role checks)
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- Users can update their own profile (name, etc.)
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Admin can update any profile (role changes)
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE TO authenticated USING (
    (SELECT public.get_my_role()) = 'admin'
  );

-- Admin can insert new profiles
CREATE POLICY "profiles_insert_admin" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT public.get_my_role()) = 'admin'
  );

-- Admin can delete profiles
CREATE POLICY "profiles_delete_admin" ON public.profiles
  FOR DELETE TO authenticated USING (
    (SELECT public.get_my_role()) = 'admin'
  );

-- ============================================================
-- Done! The getUserRole query should now work without recursion.
-- ============================================================
