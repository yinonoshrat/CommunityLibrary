# Testing Guide: Image-Based Book Detection System

This guide provides comprehensive testing procedures for the new image-based book detection system with enhanced error handling, progress tracking, and image persistence.

## Test Environment Setup

### Prerequisites
1. Local development environment running (`npm run dev`)
2. Backend and frontend both started:
   ```bash
   npm run dev:frontend    # Frontend on localhost:5174
   npm run dev:backend     # Backend on localhost:3001
   ```
3. Supabase project configured with credentials in `.env.development.local`
4. Test images prepared

### Test Images
Use images with clear book spines for best results:
- **Good**: `test-images/books-bookshelf.jpg` (multiple spines, clear text)
- **Poor**: Blurry, angled, or partial book covers
- **Edge cases**: Hebrew text, overlapping books, damaged spines

## Unit Tests

### 1. HybridVisionService Progress Callback Tests

```bash
# Run specific test file
npm run test -- api/__tests__/hybrid-vision-service.test.js

# Or with coverage
npm run test:coverage -- --files="api/__tests__/hybrid-vision-service.test.js"
```

**Test cases:**
- ✓ Progress callback called with correct stages (uploading, extracting_text, analyzing_books, etc.)
- ✓ Progress percentage increases monotonically (never goes backwards)
- ✓ Progress values between 0 and 100
- ✓ Final progress is always 100% on success
- ✓ Error results include error codes and messages
- ✓ canRetry flag is correct for each error type

### 2. Error Code Tests

```bash
npm run test -- api/__tests__/error-codes.test.js
```

**Test cases:**
- ✓ INVALID_IMAGE error for corrupted files
- ✓ OCR_FAILED error with canRetry: true
- ✓ AI_FAILED error with canRetry: true
- ✓ TIMEOUT error after 10+ minutes
- ✓ Error messages are user-friendly

### 3. Detection Job Controller Tests

```bash
npm run test -- api/__tests__/books.test.js --grep="detectBooksFromImage|getDetectionJob"
```

**Test cases:**
- ✓ Job created in database with initial status 'processing'
- ✓ Progress updates stored in database
- ✓ Stage transitions stored correctly
- ✓ Error code and message stored on failure
- ✓ Results stored with detected books
- ✓ User can only access own jobs (RLS)

## Integration Tests

### 1. Full Detection Flow (Successful)

**Test Steps:**
1. Upload valid book image via `/api/books/detect-from-image`
2. Poll `/api/books/detect-job/:jobId` every 2 seconds
3. Verify progress increases: 0% → 15% → 60% → 95% → 100%
4. Verify stage transitions: uploading → extracting_text → analyzing_books → completed
5. Verify results contain detected books with all fields
6. Verify database shows completed job with 100% progress

**Expected Behavior:**
```
Timeline:
T+0s:    POST detect-from-image → { jobId: "xxx", status: "processing", progress: 0 }
T+2s:    GET detect-job/:jobId → { progress: 15, stage: "uploading", status: "processing" }
T+4s:    GET detect-job/:jobId → { progress: 45, stage: "extracting_text" }
T+10s:   GET detect-job/:jobId → { progress: 75, stage: "analyzing_books" }
T+15s:   GET detect-job/:jobId → { progress: 95, stage: "finalizing" }
T+17s:   GET detect-job/:jobId → { progress: 100, status: "completed", result: { books: [...], count: X } }
```

**Verification:**
```sql
-- Check job in database
SELECT id, status, progress, stage, error_code FROM detection_jobs 
WHERE id = 'xxx' AND user_id = 'yyy';

-- Should show: completed | 100 | completed | NULL
```

### 2. Error Handling - Invalid Image

**Test Steps:**
1. Upload corrupted/invalid image
2. Receive error: `{ errorCode: "INVALID_IMAGE", canRetry: false }`
3. Database should show: status='failed', error_code='INVALID_IMAGE'
4. User should NOT see "Retry" option in UI

**Expected Behavior:**
```
T+0s:  POST detect-from-image → { jobId: "xxx", status: "processing" }
T+2s:  GET detect-job/:jobId → { status: "failed", error_code: "INVALID_IMAGE", 
                                  can_retry: false, error: "Invalid image format..." }
```

### 3. Error Handling - OCR Failure

**Test Steps:**
1. Upload image with **no text** (pure decorative bookshelf)
2. Should attempt anyway with OCR result = empty
3. Can still attempt AI analysis on image
4. If both fail, return error_code: "OCR_FAILED" with canRetry: true

**Expected Behavior:**
```
T+0s:  POST detect-from-image
T+3s:  Progress 0% → 20% (uploading, extracting_text still going)
T+5s:  Progress 20% → 50% (OCR completed, moving to AI)
T+20s: Status "failed", error_code: "OCR_FAILED", can_retry: true
```

### 4. Error Handling - Timeout

**Test Steps:**
1. Deploy with artificially slow AI (add delay)
2. Run detection job
3. Wait >10 minutes without completion
4. Verify cron job marks as failed with error_code: "TIMEOUT"
5. Verify can_retry: true

**Expected Behavior:**
```
Database after 10 min:
- status: 'failed'
- error_code: 'TIMEOUT'
- can_retry: true
- stage: 'failed_timeout'
```

## Frontend Tests

### 1. Progress Display

**Test Steps:**
1. Start upload → Progress bar appears and starts at 0%
2. Verify progress increases smoothly (no jumps backwards)
3. Verify stage message updates: "Extracting text..." → "Analyzing books..." etc.
4. Final progress reaches 100%

**Verification:**
```typescript
// In BulkUpload.tsx
expect(progress).toBeGreaterThanOrEqual(previousProgress); // Never decrease
expect(statusMessage).toMatch(/מחלץ|מזהה|מחפש|בודק|מוצא/); // Hebrew status messages
```

### 2. Error Display & Retry

**Test Steps:**
1. Upload invalid image
2. Error message displays in user's language
3. Verify "Retry" button appears only for canRetry: true
4. Click retry → New detection job created
5. Previous job still visible in history

**Expected UI:**
```
Error Alert:
❌ "תמונה לא חוקית. אנא העלה תמונה JPEG או PNG."
[Retry Button] [Dismiss Button]
```

### 3. Multi-Image Upload (Future)

**Test Steps:**
1. Select 3+ images
2. Each image shows individual progress card
3. Images processed sequentially or in parallel
4. Each image shows its own stage/progress
5. Can pause/cancel individual uploads

## Performance Tests

### 1. Detection Speed Benchmarks

**Test with:**
- Small image (500x500px): Should complete in 5-10 seconds
- Large image (4000x3000px): Should complete in 15-30 seconds
- Multiple images: Sequential processing

**Run benchmark:**
```bash
time npm run test -- api/__tests__/performance.test.js
```

### 2. Database Query Performance

**Test:**
1. Create 100 detection jobs
2. Query by user_id with pagination
3. Verify indexes are used

```sql
-- Check index usage
EXPLAIN ANALYZE
SELECT id, progress, stage FROM detection_jobs 
WHERE user_id = 'xxx' 
ORDER BY created_at DESC 
LIMIT 10;

-- Should show: "Index Scan" not "Seq Scan"
```

### 3. Storage Performance

**Test:**
1. Upload 50 images (10MB each)
2. Verify signed URLs generate in <100ms
3. Verify cleanup deletes 50 images in <5 seconds

## Stress Tests

### 1. Concurrent Job Handling

**Test:**
```bash
# Simulate 10 concurrent detection jobs
for i in {1..10}; do
  curl -X POST \
    -F "image=@test-images/books-bookshelf.jpg" \
    -H "Authorization: Bearer $TOKEN" \
    http://localhost:3001/api/books/detect-from-image &
done
wait
```

**Verification:**
- All 10 jobs succeed without data corruption
- Each user only sees their own jobs
- Progress tracking doesn't get mixed up

### 2. Database Load

**Test:**
```sql
-- Monitor during stress test
SELECT 
  status, COUNT(*) as count, AVG(progress) as avg_progress
FROM detection_jobs
WHERE created_at > NOW() - INTERVAL '5 minutes'
GROUP BY status;
```

## Edge Cases

### 1. Lost Connection During Upload

**Test:**
1. Start detection
2. Disconnect network at 50% progress
3. Reconnect
4. Poll for job status → Should resume or mark as timeout

**Expected:** Job eventually completes or fails with timeout

### 2. Browser Closed During Detection

**Test:**
1. Start detection on `/bulk-upload` page
2. Close browser tab
3. Reopen app → Navigate to job history
4. Previous job should show with image and current status
5. Can view results or retry

**Expected:** Job persists in database with thumbnail image

### 3. Extremely Long Image List

**Test:**
1. Detection finds 200+ books
2. UI pagination handles smoothly
3. Select/add books doesn't lag
4. Database stores all without corruption

## Cleanup & Data Retention Tests

### 1. Auto-Delete Consumed Jobs

**Test:**
1. Create detection job
2. Add books to catalog → Sets consumed_at
3. Wait 7 days (or manually run cleanup with adjusted timestamps)
4. Run cleanup cron job
5. Verify job is soft-deleted (is_deleted = true)
6. Verify image deleted from storage
7. Frontend no longer shows job in history

**SQL Verification:**
```sql
SELECT is_deleted, deleted_at FROM detection_jobs WHERE id = 'xxx';
-- Should show: true | 2024-12-18T10:00:00
```

### 2. Manual Job Deletion

**Test:**
1. Create detection job
2. User clicks "Delete" in history
3. Job soft-deleted immediately (is_deleted = true, deleted_at = now)
4. Wait 1 day
5. Cleanup cron deletes from storage

**Expected:** Hard-delete after 1 day, storage cleanup within 24 hours

### 3. Cron Job Execution

**Test:**
1. Create 5 jobs from 8 days ago
2. Run cleanup manually (simulate 2 AM cron)
3. Verify all 5 deleted
4. Verify storage cleaned
5. Check cron logs for success

## Monitoring & Observability

### 1. Log Verification

**Check backend logs:**
```bash
tail -f backend/logs/* | grep "detectBooksFromImage\|progress\|error_code"
```

**Expected logs:**
```
[detectBooksFromImage] Starting local detection for job: abc-123
[detectBooksFromImage] Progress: extracting_text - 20% - Extracting text from image...
[detectBooksFromImage] Progress: analyzing_books - 65% - Analyzing books with AI...
[detectBooksFromImage] ✓ Local detection completed for job: abc-123
```

### 2. Database Monitoring

**Monitor job stages:**
```sql
SELECT stage, COUNT(*) as count
FROM detection_jobs
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY stage
ORDER BY count DESC;
```

### 3. Error Rate Monitoring

```sql
SELECT 
  error_code, 
  COUNT(*) as count,
  COUNT(*) * 100.0 / (SELECT COUNT(*) FROM detection_jobs WHERE status = 'failed') as percentage
FROM detection_jobs
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY error_code
ORDER BY count DESC;
```

## Smoke Test Checklist

Quick validation before production:

- [ ] Create detection job → Database entry created
- [ ] Poll job status → Progress increases to 100%
- [ ] Job shows results → Correct number of books detected
- [ ] Error handling → Invalid image shows proper error message
- [ ] Frontend → Progress bar smooth, no backwards jumps
- [ ] Storage → Images saved and accessible via signed URL
- [ ] Cleanup → Old jobs deleted after retention period
- [ ] Cron jobs → Both cleanup and timeout check execute successfully

## Continuous Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test-detection.yml
name: Test Detection System

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install dependencies
        run: npm install
      
      - name: Run unit tests
        run: npm run test -- api/__tests__/
      
      - name: Run integration tests
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
        run: npm run test:integration
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Known Issues & Limitations

1. **Long OCR times**: Images with 1000+ text blocks may take 30+ seconds
   - Mitigation: Optimize text block grouping algorithm

2. **Hebrew text accuracy**: Certain fonts/orientations may be misdetected
   - Mitigation: Pre-process with image rotation detection

3. **Concurrent upload limits**: Database connection pool may limit parallel jobs
   - Mitigation: Use Supabase connection pooler (pgbouncer)

## Next Steps

1. Deploy migration 021 to Supabase
2. Deploy Supabase functions (cleanup, timeout check)
3. Configure cron jobs
4. Run smoke test checklist
5. Monitor error rates for 24 hours
6. Adjust timeout thresholds based on actual processing times
7. Set up production monitoring dashboards
