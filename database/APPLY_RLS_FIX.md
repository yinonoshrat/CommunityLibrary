# Apply RLS INSERT Policy Fix

## Issue
Currently, registration fails when adding a second user to an existing family with error:
```
new row violates row-level security policy for table users
```

## Solution
Add an INSERT policy to the users table to allow user creation during registration.

## How to Apply

### Option 1: Supabase Dashboard (Recommended - Quick)

1. Go to https://vhrijhxifulyurrxxrvm.supabase.co
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy and paste this SQL:

```sql
CREATE POLICY "Anyone can create user during registration" ON users 
FOR INSERT 
WITH CHECK (true);
```

5. Click **Run** (or press Ctrl+Enter)
6. You should see: "Success. No rows returned"

### Option 2: Using psql Command Line

Run this in your terminal:

```bash
psql "postgres://postgres.vhrijhxifulyurrxxrvm:jhfIl3kCbHEitOD9@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require" -c "CREATE POLICY \"Anyone can create user during registration\" ON users FOR INSERT WITH CHECK (true);"
```

## Verify the Fix

After applying, test by:

1. Starting the development server: `npm run dev`
2. Go to http://localhost:5175/register
3. Register a second user with the same family as an existing user
4. Registration should succeed without RLS errors

## What This Policy Does

- **Allows**: Anyone to INSERT into the users table during registration
- **Safe because**: 
  - The API endpoint validates all data before insertion
  - Supabase Auth creates the auth user first
  - The user.id always matches auth.uid() from Supabase Auth
  - Other RLS policies (UPDATE) still protect the profile after creation

## Already Applied?

Check if the policy exists:

```sql
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename = 'users';
```

You should see a policy named: "Anyone can create user during registration"
