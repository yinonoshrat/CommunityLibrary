# Migration 022 Fix Summary

## Problem

Original migration 022 attempted to create RLS policies directly on Supabase's `storage.objects` table:

```sql
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "..." ON storage.objects FOR INSERT ...
```

This failed with:
```
ERROR: 42501: must be owner of table objects
```

**Root Cause**: The `storage.objects` table is owned by Supabase's system user, not your project's role. You cannot modify it directly via migrations.

## Solution

### 1. Removed problematic code
- ❌ Removed direct `storage.objects` RLS policy creation
- ❌ Removed `cleanup_targets` view that referenced `storage.objects`
- ❌ Removed `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY`

### 2. Added database-only components
- ✅ `bucket_configuration` table - documents bucket setup
- ✅ `storage_audit_log` table - tracks storage operations
- ✅ `storage_usage_by_user` view - analytics based on audit log
- ✅ `should_cleanup_image()` function - cleanup eligibility helper
- ✅ RLS policies on `storage_audit_log` (our own table)

### 3. Created manual setup guide
- ✅ `SUPABASE_STORAGE_SETUP.md` - Step-by-step bucket creation in Dashboard
- ✅ `MIGRATION_022_DEPLOYMENT.md` - Deployment checklist and verification

## Architecture

```
User's Code (Backend/Frontend)
    ↓
Supabase Storage Bucket (created in Dashboard)
    ↓ (logs all operations)
storage_audit_log table (created via migration)
    ↓ (queries analyzed via)
storage_usage_by_user view
should_cleanup_image() function
bucket_configuration table
```

## Deployment Process

### Before: One Step (Failed)
```bash
psql < migration_022.sql  # ❌ FAILED - insufficient permissions
```

### After: Two Steps (Succeeds)

**Step 1**: Database migration (via SQL)
```bash
supabase migration up  # ✅ Creates tables, views, functions
```

**Step 2**: Bucket configuration (via Supabase Dashboard)
- Create bucket
- Add 4 RLS policies
- See `SUPABASE_STORAGE_SETUP.md` for details

## Files Modified

1. `database/migrations/022_create_storage_bucket.sql`
   - Removed: 40 lines of problematic `storage.objects` code
   - Added: Documentation and safer approach
   - Result: 129 lines total

2. **New files created**:
   - `SUPABASE_STORAGE_SETUP.md` - 200+ lines of setup guide
   - `MIGRATION_022_DEPLOYMENT.md` - Deployment checklist

## Key Insights

### What Works in Migrations
✅ Creating tables you own
✅ Creating views from your tables
✅ Creating functions
✅ Creating indexes
✅ RLS policies on YOUR tables

### What Doesn't Work in Migrations
❌ Modifying Supabase system tables (storage.objects, auth.users, etc.)
❌ Creating RLS policies on Supabase system tables
❌ Setting storage bucket properties

### Best Practice
For Supabase storage:
1. Create bucket in Dashboard → Configure RLS
2. Create audit tables in migration → Store operation logs
3. Create views/functions in migration → Analyze audit logs

## Verification

Migration applied successfully:

```sql
SELECT * FROM bucket_configuration;
-- Result: 1 row documenting detection-job-images setup

SELECT * FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('bucket_configuration', 'storage_audit_log');
-- Result: 2 rows (both tables created)

SELECT viewname FROM pg_views 
WHERE schemaname = 'public' 
AND viewname = 'storage_usage_by_user';
-- Result: 1 row (view created)
```

## Next Steps

1. Open Supabase Dashboard
2. Create bucket `detection-job-images` as PRIVATE
3. Add 4 RLS policies (see `SUPABASE_STORAGE_SETUP.md`)
4. Test upload/download with sample image
5. Deploy image storage service code
6. Deploy cleanup Edge Functions
7. Monitor first cleanup run

## References

- Supabase Docs: https://supabase.com/docs/guides/storage
- RLS Policies: https://supabase.com/docs/guides/storage#access-control
- Our Setup Guide: `SUPABASE_STORAGE_SETUP.md`
- Full Implementation: `IMPLEMENTATION_PHASE3_COMPLETE.md`

---

**Status**: ✅ Migration fixed and applied successfully. Ready for manual bucket setup in Dashboard.
