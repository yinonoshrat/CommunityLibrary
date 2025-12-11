# Supabase Storage Bucket Setup Guide

## Overview

The detection system requires a private Supabase Storage bucket for persisting images. Due to Supabase permissions, the bucket and RLS policies must be configured via the Supabase Dashboard rather than SQL migrations.

## Step-by-Step Setup

### 1. Create the Storage Bucket

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Storage** → **Buckets**
4. Click **New Bucket**
5. Fill in the details:
   - **Name**: `detection-job-images`
   - **Public bucket**: Toggle OFF (keep it private)
6. Click **Create**

### 2. Set Up RLS Policies

Once the bucket is created, you need to add Row Level Security (RLS) policies. These control who can access the images.

#### Policy 1: Users Can Upload Their Own Images

1. In the bucket details, click **Policies** tab
2. Click **New Policy**
3. Select **For inserts** from the dropdown
4. Name: `Users can upload images to their detection jobs`
5. In the policy editor, enter:
```sql
(bucket_id = 'detection-job-images'::text) 
AND (auth.uid()::text = (storage.foldername(name))[1])
```
6. Click **Save**

This policy:
- Only applies to the `detection-job-images` bucket
- Ensures users can only upload to their own folder (first part of path = their user ID)
- Example: User `abc-123` can upload to `abc-123/job-xyz/original.jpg` but not `other-user/...`

#### Policy 2: Users Can Read Their Own Images

1. Click **New Policy** again
2. Select **For selects** from the dropdown
3. Name: `Users can view their own detection job images`
4. In the policy editor, enter:
```sql
(bucket_id = 'detection-job-images'::text) 
AND (auth.uid()::text = (storage.foldername(name))[1])
```
5. Click **Save**

This allows users to read/download their own images.

#### Policy 3: Users Can Delete Their Own Images

1. Click **New Policy** again
2. Select **For deletes** from the dropdown
3. Name: `Users can delete their own detection job images`
4. In the policy editor, enter:
```sql
(bucket_id = 'detection-job-images'::text) 
AND (auth.uid()::text = (storage.foldername(name))[1])
```
5. Click **Save**

This allows users to delete their own images.

#### Policy 4: Service Role Can Manage Images (For Cleanup)

1. Click **New Policy** again
2. Select **For all operations** from the dropdown
3. Name: `Service role can manage detection job images`
4. In the policy editor, paste:
```
-- Note: Service role policies allow Edge Functions and backend with 
-- SUPABASE_SERVICE_ROLE_KEY to bypass RLS
(true)
```
5. Click **Save**
6. Important: Make sure you set the **Role** dropdown to `service_role` (not `authenticated`)

This policy allows Edge Functions and backend services (with the service role key) to delete old images during cleanup operations.

### 3. Verify Bucket Configuration

After setting up the bucket and policies:

1. Check the bucket settings:
   - **Storage** → **Buckets** → **detection-job-images**
   - Verify it shows as **Private**
   
2. Verify policies are in place:
   - Click the bucket
   - Go to **Policies** tab
   - You should see 4 policies listed

3. Test the setup:
   ```sql
   -- Check if bucket exists
   SELECT * FROM storage.buckets WHERE id = 'detection-job-images';
   
   -- Should return 1 row with public = false
   ```

## Running the Migration

After setting up the bucket in the Dashboard:

```bash
# Apply the migration to create audit logging tables
psql -d $POSTGRES_URL -f database/migrations/022_create_storage_bucket.sql
```

This migration creates:
- `storage_audit_log` table - Tracks all storage operations
- `bucket_configuration` table - Documents the bucket setup
- `storage_usage_by_user` view - Shows storage usage per user
- Helper function `should_cleanup_image()` - Determines cleanup eligibility

## Testing the Storage Setup

### Test Upload (From Your App)

```javascript
// This should work - uploading to your own folder
const { data, error } = await supabase.storage
  .from('detection-job-images')
  .upload(`${userId}/job-123/original.jpg`, file);
```

### Test Read Access

```javascript
// This should work - reading your own image
const { data, error } = await supabase.storage
  .from('detection-job-images')
  .download(`${userId}/job-123/original.jpg`);
```

### Test Signed URLs

```javascript
// This should work - generating signed URL for your own image
const { data, error } = await supabase.storage
  .from('detection-job-images')
  .createSignedUrl(`${userId}/job-123/original.jpg`, 7 * 24 * 60 * 60);
```

### Test Service Role Cleanup (From Backend)

```javascript
// This should work - service role can delete any image
const { error } = await supabaseServiceRole.storage
  .from('detection-job-images')
  .remove([`${userId}/job-123/original.jpg`]);
```

## Troubleshooting

### "Access Denied" When Uploading

**Problem**: Users can't upload images
- Check Policy 1 is enabled and set to `authenticated` role
- Verify policy SQL is correct (check for typos)
- Ensure `auth.uid()` is being used (not null)

**Solution**:
```sql
-- Debug: Check if auth.uid() is available
SELECT auth.uid(); -- Should return your user ID
```

### "Access Denied" When Reading Images

**Problem**: Users can't read their own images after upload
- Check Policy 2 is enabled for `SELECT` operations
- Verify the path structure matches: `{user_id}/{job_id}/...`

**Solution**:
```sql
-- List objects in bucket
SELECT * FROM storage.objects 
WHERE bucket_id = 'detection-job-images' 
LIMIT 10;
```

### Cleanup Functions Fail with "Access Denied"

**Problem**: Cleanup Edge Function or cron job fails
- Check Policy 4 exists and is set to `service_role` (not `authenticated`)
- Verify Policy 4 is for "all operations" not just specific operations
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in environment

**Solution**:
```bash
# Test service role key works
curl -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "https://$PROJECT.supabase.co/rest/v1/storage/objects" \
  -d '{"bucket_id": "detection-job-images"}'
```

### Can't Create Bucket

**Problem**: Bucket creation fails in Dashboard
- Check you have admin permissions in the Supabase project
- Try renaming (bucket name must be lowercase and contain only letters, numbers, hyphens)
- Clear browser cache and refresh

## Database Views and Functions

After running the migration, you have these tools available:

### View: storage_usage_by_user
Check storage usage by user:
```sql
SELECT * FROM storage_usage_by_user;
-- Shows: user_id, total_bytes_used, file_count, usage_status
```

### Function: should_cleanup_image()
Check if an image should be cleaned up:
```sql
SELECT should_cleanup_image(created_at) 
FROM detection_jobs 
WHERE image_uploaded_at IS NOT NULL;
-- Returns true if image is >7 days old
```

## Next Steps

1. ✅ Create bucket in Supabase Dashboard
2. ✅ Add RLS policies (4 policies total)
3. ✅ Run migration: `psql -d $POSTGRES_URL < migrations/022_*.sql`
4. ✅ Test upload/download/delete
5. ✅ Deploy Edge Functions for cleanup
6. ✅ Deploy backend code that uses storage

## References

- [Supabase Storage Docs](https://supabase.com/docs/guides/storage)
- [RLS Policies](https://supabase.com/docs/guides/storage#access-control)
- [Signed URLs](https://supabase.com/docs/guides/storage#signed-urls)
