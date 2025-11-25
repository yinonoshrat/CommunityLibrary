# Database Migrations

## How to Apply Migrations

### Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the migration file and copy its contents
4. Paste into the SQL Editor
5. Click **Run** to execute the migration

### Using Supabase CLI

```bash
# If you have Supabase CLI installed
supabase db push
```

## Migration Files

### 002_add_auth_email_column.sql
**Purpose:** Adds support for multiple users with the same email address

**Changes:**
- Adds `auth_email` column to `users` table (stores unique email for Supabase Auth)
- Removes UNIQUE constraint from `email` column (allows sharing)
- Migrates existing users: sets `auth_email` = `email` for all existing records

**Required:** Yes, must run before using the shared email feature

**Safe to run multiple times:** Yes (uses `IF NOT EXISTS` and `IF EXISTS` checks)
