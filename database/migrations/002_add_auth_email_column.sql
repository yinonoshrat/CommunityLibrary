-- Migration: Add auth_email column to support multiple users with same email
-- Date: 2025-11-24

-- Add auth_email column
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_email VARCHAR(255);

-- For existing users, set auth_email to their current email
UPDATE users SET auth_email = email WHERE auth_email IS NULL;

-- Make auth_email NOT NULL and UNIQUE
ALTER TABLE users ALTER COLUMN auth_email SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_auth_email_unique UNIQUE (auth_email);

-- Remove UNIQUE constraint from email column if it exists
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;

-- Add comment explaining the columns
COMMENT ON COLUMN users.email IS 'Actual email address (can be shared by multiple users)';
COMMENT ON COLUMN users.auth_email IS 'Unique email used in Supabase Auth (internal use only)';
