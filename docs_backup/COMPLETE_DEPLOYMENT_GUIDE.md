# Complete Deployment Guide: Detection System

## Overview

This guide walks through deploying the complete detection system from code to production.

## Phase 1: Database Migrations ✅

### Migration 021: Enhanced detection_jobs table
**Status**: ✅ Applied
**What it does**: Adds 13 new columns for image storage, error tracking, and progress monitoring

```bash
supabase migration up
# Or manually: psql $POSTGRES_URL < database/migrations/021_*.sql
```

**Verification**:
```sql
\d detection_jobs
-- Should show new columns: image_storage_path, error_code, stage, etc.
```

### Migration 022: Storage bucket configuration and audit logging
**Status**: ✅ Applied  
**What it does**: Creates audit logging tables and helper functions

```bash
supabase migration up
# Or manually: Supabase MCP tool (already applied above)
```

**Verification**:
```sql
SELECT * FROM bucket_configuration;
SELECT * FROM storage_usage_by_user;
SELECT should_cleanup_image(NOW() - INTERVAL '8 days');
```

---

## Phase 2: Supabase Storage Setup (Manual)

### Step 1: Create Storage Bucket

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. **Storage** → **Buckets** → **New Bucket**
4. Name: `detection-job-images`
5. **Uncheck** "Public bucket" (keep it PRIVATE)
6. Click **Create**

### Step 2: Add RLS Policies

For each policy below, click **New Policy** in the Policies tab:

#### Policy 1: Users upload (authenticated)
- **Operation**: Insert
- **Rule**:
```sql
(bucket_id = 'detection-job-images'::text) 
AND (auth.uid()::text = (storage.foldername(name))[1])
```
- **Role**: authenticated ← Important!

#### Policy 2: Users read (authenticated)
- **Operation**: Select
- **Rule**:
```sql
(bucket_id = 'detection-job-images'::text) 
AND (auth.uid()::text = (storage.foldername(name))[1])
```
- **Role**: authenticated ← Important!

#### Policy 3: Users delete (authenticated)
- **Operation**: Delete
- **Rule**:
```sql
(bucket_id = 'detection-job-images'::text) 
AND (auth.uid()::text = (storage.foldername(name))[1])
```
- **Role**: authenticated ← Important!

#### Policy 4: Service role manages all
- **Operation**: All (or SELECT, UPDATE, DELETE)
- **Rule**:
```sql
(true)
```
- **Role**: service_role ← Very important! Must be service_role, not authenticated

### Step 3: Verify Bucket Setup

```bash
# Test signed URL generation
curl -X POST \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  "$SUPABASE_URL/rest/v1/rpc/get_bucket_info" \
  -d '{"bucket_id": "detection-job-images"}'

# Should succeed and show bucket is private
```

---

## Phase 3: Backend Code Deployment

### What's deployed

1. **Storage Service** (`backend_shared_src/services/storageService.js`)
   - Image upload to Supabase
   - Thumbnail generation
   - Signed URL management
   - Storage quota tracking

2. **Enhanced Controller** (`backend_shared_src/controllers/books.controller.js`)
   - Updated `detectBooksFromImage` with image storage
   - Updated `getDetectionJob` with image metadata

3. **HybridVisionService** (`backend_shared_src/services/hybridVision.js`)
   - Progress callbacks
   - Error code returns
   - Metadata tracking

### Deploy Steps

```bash
# 1. Update dependencies if needed
cd api && npm install @supabase/supabase-js sharp

# 2. Build/verify code
npm run build

# 3. Deploy to Vercel (if using Vercel)
vercel --prod

# 4. Or push to git (if using Git integration)
git add .
git commit -m "feat: complete detection system deployment"
git push origin main
```

### Environment Variables

Add to your `.env` or Vercel:

```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxx
SUPABASE_ANON_KEY=xxxx
GEMINI_API_KEY=xxxx
OPENAI_API_KEY=xxxx
CRON_SECRET=random-secret-string
```

---

## Phase 4: Edge Functions Deployment

### Functions to Deploy

1. **cleanup-detection-jobs** (`supabase/functions/cleanup-detection-jobs/`)
   - Runs: Daily at 2 AM UTC
   - Does: Deletes images >7 days old

2. **mark-jobs-as-failed-if-stuck** (`supabase/functions/mark-jobs-as-failed-if-stuck/`)
   - Runs: Every 5 minutes
   - Does: Marks processing jobs >10 min as failed

### Deploy via Supabase CLI

```bash
# 1. Link to your Supabase project
supabase link --project-ref xxx

# 2. Deploy Edge Functions
supabase functions deploy cleanup-detection-jobs
supabase functions deploy mark-jobs-as-failed-if-stuck

# 3. Set secrets in Supabase
supabase secrets set CRON_SECRET=your-secret
```

### Test Functions

```bash
# Test cleanup function
curl -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  https://xxx.supabase.co/functions/v1/cleanup-detection-jobs

# Test timeout detection
curl -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  https://xxx.supabase.co/functions/v1/mark-jobs-as-failed-if-stuck
```

---

## Phase 5: Cron Jobs Setup

### Option A: Vercel Crons (Recommended)

Already configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-detection-jobs",
      "schedule": "0 2 * * *"  // Daily 2 AM
    },
    {
      "path": "/api/cron/check-job-timeouts",
      "schedule": "*/5 * * * *"  // Every 5 min
    }
  ]
}
```

Deploy and crons start automatically.

### Option B: GitHub Actions

Already configured in `.github/workflows/detection-job-maintenance.yml`

Commit to main and actions run on schedule automatically.

### Option C: Manual Testing

```bash
# Test cleanup
curl -X GET \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://yourdomain.com/api/cron/cleanup-detection-jobs

# Test timeout check
curl -X GET \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://yourdomain.com/api/cron/check-job-timeouts
```

---

## Phase 6: Frontend Deployment

### Components Added

1. **DetectionJobHistory** - View all past jobs
2. **ImageUploadManager** - Upload manager
3. **BulkUpload enhancements** - Retry UI and job tracking

### Deploy Steps

```bash
# 1. Build frontend
cd frontend
npm run build

# 2. Test locally
npm run dev

# 3. Deploy
vercel --prod  # or git push
```

---

## Phase 7: Testing & Verification

### Test Checklist

```
Database:
  [ ] Migration 021 applied (detection_jobs columns exist)
  [ ] Migration 022 applied (audit_log table exists)
  [ ] storage_usage_by_user view works
  [ ] should_cleanup_image() function works

Storage:
  [ ] Bucket created in Supabase Dashboard
  [ ] 4 RLS policies added
  [ ] Can upload test image
  [ ] Can download test image
  [ ] Signed URL generation works

Backend:
  [ ] POST /api/books/detect-from-image returns jobId
  [ ] GET /api/detection-jobs/:jobId returns job status
  [ ] Image is stored in Supabase Storage
  [ ] Image metadata stored in database

Frontend:
  [ ] Upload page loads
  [ ] Can select image
  [ ] Progress bar updates
  [ ] Detection completes
  [ ] Results display correctly
  [ ] History page shows jobs

Cron Jobs:
  [ ] Cleanup function can be called manually
  [ ] Timeout detection can be called manually
  [ ] Both return proper JSON responses
  [ ] Scheduled crons have run (check logs)
```

### Manual Test Commands

```bash
# Test storage upload
curl -X POST \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -F "file=@test.jpg" \
  https://$SUPABASE_URL/storage/v1/object/sign/detection-job-images/test-user/test.jpg

# Test detection job creation
curl -X POST \
  -F "image=@test.jpg" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  https://yourdomain.com/api/books/detect-from-image

# Test job status polling
curl -X GET \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  https://yourdomain.com/api/detection-jobs/job-id
```

---

## Phase 8: Monitoring

### Dashboard Queries

```sql
-- Recent detection jobs
SELECT id, status, stage, progress, created_at 
FROM detection_jobs 
ORDER BY created_at DESC LIMIT 10;

-- Failed jobs
SELECT id, error_code, error, can_retry 
FROM detection_jobs 
WHERE status = 'failed' 
ORDER BY created_at DESC LIMIT 10;

-- Storage usage
SELECT * FROM storage_usage_by_user;

-- Stuck jobs (>10 min)
SELECT id, stage, EXTRACT(MINUTE FROM (NOW() - created_at)) as stuck_minutes
FROM detection_jobs 
WHERE status = 'processing' 
AND created_at < NOW() - INTERVAL '10 minutes';

-- Recent cleanup operations
SELECT * FROM storage_audit_log 
WHERE operation = 'delete' 
ORDER BY created_at DESC LIMIT 20;
```

### Log Monitoring

**Vercel Logs**:
- Dashboard → Deployments → select deployment → Logs
- Look for: `[cleanup-detection-jobs]`, `[check-job-timeouts]`

**Supabase Logs**:
- Dashboard → Edge Functions → select function
- Check for errors and request counts

**GitHub Actions**:
- Repository → Actions → Detection Job Maintenance
- Check run history and logs

---

## Phase 9: Post-Deployment

### After First 24 Hours

- [ ] Check error logs for any issues
- [ ] Verify cleanup job ran successfully
- [ ] Verify timeout detection ran
- [ ] Test image retention (7-day policy)
- [ ] Test user retry functionality

### After First Week

- [ ] Monitor error rates and patterns
- [ ] Check storage usage trends
- [ ] Review audit logs for anomalies
- [ ] Adjust error messages based on user feedback
- [ ] Optimize slow stages if needed

### Metrics to Track

- Avg detection time per stage
- Error rate by error code
- Storage usage per user
- Failed job retry success rate
- Cleanup job success rate

---

## Troubleshooting

### Storage Upload Fails

```sql
-- Check RLS policies
SELECT * FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage';

-- Check bucket exists
SELECT * FROM storage.buckets 
WHERE id = 'detection-job-images';
```

### Cron Jobs Not Running

```bash
# Check Vercel logs
vercel logs --follow

# Check GitHub Actions
# Repository → Actions → Detection Job Maintenance

# Test manually
curl -X GET \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://yourdomain.com/api/cron/cleanup-detection-jobs
```

### Images Not Deleted After 7 Days

```sql
-- Check if cleanup ran
SELECT * FROM storage_audit_log 
WHERE operation = 'delete' 
ORDER BY created_at DESC;

-- Check if images are marked as deleted
SELECT * FROM detection_jobs 
WHERE is_deleted = true 
ORDER BY deleted_at DESC;
```

---

## Rollback Plan

If something goes wrong:

1. **Database**: Migrations are one-way, but you can keep old data
2. **Storage**: Delete bucket and recreate
3. **Code**: Revert to previous commit
4. **Edge Functions**: Update function code or disable
5. **Cron Jobs**: Disable in vercel.json or GitHub Actions

---

## Support Resources

- `DETECTION_QUICK_REFERENCE.md` - Quick API reference
- `IMPLEMENTATION_PHASE3_COMPLETE.md` - Complete system overview
- `SUPABASE_STORAGE_SETUP.md` - Detailed storage setup
- `MIGRATION_022_FIX_SUMMARY.md` - Migration troubleshooting
- `MIGRATION_022_DEPLOYMENT.md` - Deployment checklist

---

**Status**: Ready for production deployment ✅
