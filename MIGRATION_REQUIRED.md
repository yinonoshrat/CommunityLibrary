# IMPORTANT: Apply Database Migration

The system now supports multiple users with the same email address, but requires a database migration.

## Quick Fix - Apply Migration Now:

1. **Open Supabase Dashboard:**
   - Go to https://supabase.com/dashboard
   - Select your CommunityLibrary project
   - Click on "SQL Editor" in the left sidebar

2. **Run this SQL:**
   ```sql
   -- Add auth_email column to support multiple users with same email
   ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_email VARCHAR(255);

   -- For existing users, set auth_email to their current email
   UPDATE users SET auth_email = email WHERE auth_email IS NULL;

   -- Make auth_email NOT NULL and UNIQUE
   ALTER TABLE users ALTER COLUMN auth_email SET NOT NULL;
   
   -- Drop existing unique constraint on email (if exists)
   ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
   
   -- Add unique constraint on auth_email
   DO $$ 
   BEGIN
       IF NOT EXISTS (
           SELECT 1 FROM pg_constraint 
           WHERE conname = 'users_auth_email_unique'
       ) THEN
           ALTER TABLE users ADD CONSTRAINT users_auth_email_unique UNIQUE (auth_email);
       END IF;
   END $$;
   ```

3. **Click "RUN"** to execute

## What This Does:

- ✅ Allows multiple family members to share one email address
- ✅ Maintains backward compatibility with existing users
- ✅ Each user still needs a unique password
- ✅ Login flow automatically detects single vs multiple accounts

## After Migration:

- New users can register with any email (even if already used)
- Existing users can login as before
- If multiple accounts share an email, login will prompt to choose which account

## Troubleshooting:

**Error: "column auth_email does not exist"**
→ You need to run the migration above

**Error: "invalid credentials" during login**
→ The migration hasn't been applied yet, or the backend needs to restart

**Want to test?**
1. Apply the migration
2. Restart the backend: `npm run dev` (in the root directory)
3. Try to login or register
