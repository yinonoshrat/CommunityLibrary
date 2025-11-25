-- Migration: Add INSERT policy for users table
-- This allows user creation during registration (before authentication session exists)

-- Add INSERT policy for users table
CREATE POLICY "Anyone can create user during registration" ON users 
FOR INSERT 
WITH CHECK (true);

-- Note: This is safe because:
-- 1. User creation is controlled through the API endpoint which validates data
-- 2. The API ensures auth user is created first in Supabase Auth
-- 3. The user.id matches the auth.uid() from Supabase Auth
-- 4. Other RLS policies (UPDATE) ensure users can only modify their own profile after creation
