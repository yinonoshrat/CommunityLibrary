# Quick Reference: Enhanced Image Detection System

## What Changed?

### 🎯 For End Users
- **Better error messages**: "Invalid image format" instead of generic errors
- **Smooth progress tracking**: Progress bar goes 0→100% without jumping backwards
- **Job persistence**: Can close browser and return to unfinished jobs with images
- **Automatic cleanup**: Old jobs deleted automatically after 7 days
- **Retry guidance**: Clear indication of which errors can be retried

### 🔧 For Developers

#### New Files
```
backend_shared_src/constants/detectionErrors.js      (Error code definitions)
database/migrations/021_enhance_detection_jobs_table.sql (Schema changes)
supabase/functions/cleanup-detection-jobs/index.ts   (Cleanup cron)
supabase/functions/mark-jobs-as-failed-if-stuck/index.ts (Timeout detection)
STORAGE_SETUP.md                                     (Storage guide)
CRON_JOBS.md                                         (Cron setup guide)
TESTING_DETECTION_SYSTEM.md                          (Testing guide)
IMPLEMENTATION_SUMMARY.md                            (This implementation)
```

#### Modified Files
```
backend_shared_src/services/hybridVision.js
├─ detectBooksFromImage(): Now supports progress callbacks
└─ Returns: { books, errorCode?, errorMessage?, canRetry?, metadata }

backend_shared_src/controllers/books.controller.js
├─ detectBooksFromImage(): Uses progress callbacks
└─ Stores error_code, stage, can_retry in database

frontend/src/pages/BulkUpload.tsx
├─ Progress: Now uses backend value directly (no hardcoded milestones)
└─ Errors: Maps error_code to user-friendly messages
```

## API Changes

### HybridVisionService.detectBooksFromImage()

**Before:**
```typescript
async detectBooksFromImage(imageBuffer: Buffer): Promise<Book[]>
  → throws Error on failure
  → returns array on success
```

**After:**
```typescript
async detectBooksFromImage(
  imageBuffer: Buffer, 
  options?: { onProgress?: (stage, percent, message) => Promise<void> }
): Promise<{
  books: Book[],
  errorCode?: string,
  errorMessage?: string,
  canRetry?: boolean,
  metadata: {
    successfullyProcessed: boolean,
    duration_ms: number,
    ocrBlocksCount: number,
    booksDetected: number,
    avgConfidence: number,
    ...
  }
}>
```

### GET /api/books/detect-job/:jobId

**New Fields in Response:**
```json
{
  "id": "xxx",
  "status": "processing|completed|failed",
  "progress": 0-100,
  "stage": "pending|uploading|extracting_text|analyzing_books|...",
  "error_code": "INVALID_IMAGE|OCR_FAILED|AI_FAILED|TIMEOUT|null",
  "can_retry": true|false,
  "result": { "books": [...], "count": N },
  "created_at": "2025-12-11T...",
  "updated_at": "2025-12-11T..."
}
```

## Common Tasks

### 1. Deploy to Production

```bash
# 1. Apply database migration
supabase db push

# 2. Deploy Supabase functions
supabase functions deploy cleanup-detection-jobs
supabase functions deploy mark-jobs-as-failed-if-stuck

# 3. Create storage bucket (follow STORAGE_SETUP.md)

# 4. Configure cron jobs (choose option from CRON_JOBS.md)

# 5. Test (follow TESTING_DETECTION_SYSTEM.md)
npm run test -- api/__tests__/
```

### 2. Debug a Failed Job

```sql
-- Check job status
SELECT id, status, progress, stage, error_code, error 
FROM detection_jobs 
WHERE id = 'job-uuid-here';

-- Check if it's marked as timeout
SELECT * FROM detection_jobs 
WHERE status = 'failed' 
  AND error_code = 'TIMEOUT' 
  AND updated_at > NOW() - INTERVAL '1 hour';

-- View jobs that need cleanup
SELECT id, user_id, consumed_at 
FROM detection_jobs 
WHERE consumed_at < NOW() - INTERVAL '7 days' 
  AND NOT is_deleted;
```

### 3. Manually Trigger Cleanup

```bash
# Test cleanup job
curl -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  https://$PROJECT_ID.functions.supabase.co/functions/v1/cleanup-detection-jobs

# Expected response:
# { "message": "Cleanup completed", "deleted": 5, "errors": 0, "processed": 5 }
```

### 4. Monitor Error Rates

```sql
-- Error rate in past 24 hours
SELECT 
  error_code,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM detection_jobs WHERE created_at > NOW() - INTERVAL '24 hours'), 1) as percentage
FROM detection_jobs
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY error_code
ORDER BY count DESC;
```

### 5. Extend Job Retention

```sql
-- Change retention from 7 to 14 days
-- Find and update the cleanup function, or manually delete after 14 days

-- Mark old job for deletion
UPDATE detection_jobs 
SET deleted_at = NOW() 
WHERE id = 'job-uuid' AND NOT is_deleted;

-- Hard delete (after 1 day waiting period)
UPDATE detection_jobs 
SET is_deleted = true 
WHERE deleted_at < NOW() - INTERVAL '1 day';
```

## Error Codes Reference

| Code | Message | Retry? | Action |
|------|---------|--------|--------|
| INVALID_IMAGE | Invalid image format | ❌ No | Upload JPEG/PNG |
| OCR_FAILED | Text extraction failed | ✅ Yes | Try clearer image |
| AI_FAILED | Book identification failed | ✅ Yes | Try different angle |
| TIMEOUT | Processing timeout | ✅ Yes | Try simpler image |
| RATE_LIMITED | Too many requests | ✅ Yes | Wait few minutes |
| SERVICE_UNAVAILABLE | Service down | ✅ Yes | Try again later |
| NO_BOOKS_DETECTED | No books found | ✅ Yes | Try different image |

## Performance Tuning

### Slow Detection?
1. **Check image size**: Recommended max 3000x3000px
2. **Monitor OCR**: Check if extracting_text stage takes >20s
3. **Optimize prompts**: See `backend_shared_src/services/aiModelWrapper.js`

### High Memory Usage?
1. **Reduce thumbnail size**: Currently 500KB, can reduce to 300KB
2. **Enable image compression**: Use sharp library
3. **Increase cleanup frequency**: Run cleanup every 12 hours instead of 24

### Database Growing?
1. **Verify cleanup running**: Check cron job logs
2. **Manual cleanup**: Run cleanup function manually
3. **Clear image columns**: Hard delete old jobs to save space

## Testing Workflow

### Quick Smoke Test
```bash
# 1. Start dev server
npm run dev

# 2. Upload test image
# Navigate to http://localhost:5174/bulk-upload
# Upload test image from test-images/

# 3. Watch console for progress
# Should see stages: uploading → extracting_text → analyzing_books → completed

# 4. Verify results
# Should show detected books with authors
```

### Full Test Suite
```bash
# Run all tests
npm run test

# Test specific feature
npm run test -- api/__tests__/books.test.js --grep "detect"

# Coverage report
npm run test:coverage
```

## Rollback Plan

If issues occur:

### Step 1: Disable New Features
```bash
# Stop cron jobs (GitHub Actions workflow)
# Disable cleanup function (don't deploy)
```

### Step 2: Revert Code
```bash
# Revert backend changes
git revert backend_shared_src/services/hybridVision.js
git revert backend_shared_src/controllers/books.controller.js

# Revert frontend changes
git revert frontend/src/pages/BulkUpload.tsx
```

### Step 3: Optional: Revert Database
```bash
# Down migration (careful: destroys new columns)
supabase migration down

# Or keep migration, just don't use new columns
```

## Support Commands

```bash
# View backend logs
tail -f backend/logs/*

# Check frontend console (browser DevTools)
# F12 → Console tab

# View Supabase function logs
supabase functions logs cleanup-detection-jobs --project-ref YOUR_PROJECT

# Test API endpoint
curl http://localhost:3001/api/books/detect-job/{jobId} \
  -H "Authorization: Bearer $TOKEN"

# Monitor database
psql $DATABASE_URL -c "SELECT stage, COUNT(*) FROM detection_jobs GROUP BY stage;"

# Check storage bucket
supabase storage ls detection-job-images/

# View cron execution
# GitHub: Actions → Workflows → Detection Job Cleanup
# Vercel: Project → Deployments → Functions → Cron logs
```

## Next Steps

1. **Review** each documentation file
2. **Test** following `TESTING_DETECTION_SYSTEM.md`
3. **Deploy** following the checklist above
4. **Monitor** error rates and job completion times
5. **Adjust** timeout threshold based on actual performance
6. **Plan** future enhancements (multi-image, batching, etc.)

## Questions?

Refer to:
- **Storage Issues**: `STORAGE_SETUP.md`
- **Cron Configuration**: `CRON_JOBS.md`
- **Testing Procedures**: `TESTING_DETECTION_SYSTEM.md`
- **Implementation Details**: `IMPLEMENTATION_SUMMARY.md`
- **Error Handling**: See error codes table above
