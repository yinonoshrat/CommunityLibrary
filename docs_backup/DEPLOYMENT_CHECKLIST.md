# Deployment Checklist: Enhanced Image Detection System

## Pre-Deployment (1-2 days before)

### Code Review & Testing
- [ ] Review all modified files in this PR
- [ ] Run full test suite: `npm run test`
- [ ] Run integration tests: `npm run test:integration`
- [ ] Manual testing on local dev environment
- [ ] Verify no console errors in browser DevTools
- [ ] Check TypeScript strict mode compliance

### Documentation Review
- [ ] Read `IMPLEMENTATION_SUMMARY.md`
- [ ] Review `QUICK_REFERENCE.md`
- [ ] Understand `STORAGE_SETUP.md` requirements
- [ ] Understand `CRON_JOBS.md` options
- [ ] Review `TESTING_DETECTION_SYSTEM.md` test cases

### Environment Preparation
- [ ] Pull latest `.env` variables from Supabase
- [ ] Verify all required API keys present:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_ANON_KEY`
  - `GEMINI_API_KEY` or `OPENAI_API_KEY`
  - `GOOGLE_APPLICATION_CREDENTIALS` (for hybrid)
- [ ] Test database connection: `psql $DATABASE_URL -c "SELECT 1"`

## Deployment Day (Morning)

### 1. Database Migration (30 minutes)

**⚠️ This step modifies database schema - have backup ready**

```bash
# Create backup
pg_dump $DATABASE_URL > backup-pre-migration-$(date +%Y%m%d).sql

# Apply migration
supabase db push

# Verify migration applied
psql $DATABASE_URL -c "SELECT COUNT(*) FROM detection_jobs;"
```

**Rollback if needed:**
```bash
# Don't rollback - migration is additive only
# Old columns unchanged, new columns default to NULL
```

### 2. Backend Code Deployment (15 minutes)

```bash
# Build
npm run build

# Verify syntax
node -c backend_shared_src/services/hybridVision.js
node -c backend_shared_src/controllers/books.controller.js
node -c backend_shared_src/constants/detectionErrors.js

# Deploy (method depends on your setup)
# Option A: Vercel
vercel --prod

# Option B: Docker/Container
docker build -t community-lib:latest .
docker push your-registry/community-lib:latest

# Option C: Manual
git push main  # If configured with auto-deploy
```

**Verify deployment:**
```bash
# Check backend health
curl https://your-api.com/api/health

# Check no errors in logs
# Check dashboard/console for errors
```

### 3. Frontend Code Deployment (15 minutes)

```bash
# Build
cd frontend && npm run build

# Verify no TypeScript errors
npx tsc --noEmit

# Deploy (method depends on your setup)
# Option A: Vercel (auto-deployed with backend)
vercel --prod

# Option B: S3 + CloudFront
aws s3 sync ./dist s3://your-bucket/
aws cloudfront create-invalidation --distribution-id YOUR_ID --paths "/*"
```

**Verify deployment:**
```bash
# Check frontend loads
curl https://your-app.com | grep "BulkUpload"

# Test in browser - check console for errors
```

### 4. Supabase Functions Deployment (20 minutes)

```bash
# Deploy cleanup function
supabase functions deploy cleanup-detection-jobs

# Deploy timeout check function
supabase functions deploy mark-jobs-as-failed-if-stuck

# Verify functions deployed
supabase functions list

# Test functions
# See CRON_JOBS.md for test commands
```

**Verify functions:**
```bash
# Check logs
supabase functions logs cleanup-detection-jobs --project-ref YOUR_PROJECT

# Manual test
curl -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  https://$PROJECT_ID.functions.supabase.co/functions/v1/cleanup-detection-jobs
```

### 5. Storage Setup (30 minutes)

**Via Supabase Dashboard:**
1. Go to Storage → Buckets
2. Click "Create a new bucket"
3. Name: `detection-job-images`
4. Visibility: Private
5. Size limit: 10 MB
6. Click Create

**Add RLS Policies:**
1. Click bucket name
2. Click "Policies" tab
3. Add 4 policies from `STORAGE_SETUP.md`

**Or via SQL:**
```bash
# Execute SQL from STORAGE_SETUP.md
# Copy all RLS policy CREATE statements
# Paste into SQL Editor in Supabase Dashboard
# Execute
```

**Verify storage:**
```bash
# List buckets
supabase storage ls /

# Should see: detection-job-images
```

### 6. Configure Cron Jobs (30 minutes)

**Choose ONE method from below:**

#### Option A: GitHub Actions (Recommended)
```bash
# Create file: .github/workflows/detection-cleanup.yml
# Copy content from CRON_JOBS.md → "Option 1: GitHub Actions"

# Add secrets to GitHub:
# - SUPABASE_SERVICE_ROLE_KEY
# - SUPABASE_PROJECT_ID

# Commit and push
git add .github/workflows/detection-cleanup.yml
git commit -m "Add detection job cron workflows"
git push origin main

# Verify in GitHub Actions tab
```

#### Option B: Vercel Cron (If using Vercel for API)
```bash
# Create file: api/cron/detection-cleanup.ts
# Copy content from CRON_JOBS.md → "Option 2: Vercel"

# Add secret to Vercel:
# - CRON_SECRET (generate random string)
# - SUPABASE_SERVICE_ROLE_KEY
# - SUPABASE_PROJECT_ID

# Update vercel.json with cron config

# Deploy
vercel --prod

# Verify in Vercel dashboard → Functions → Crons
```

#### Option C: Supabase pg_cron (Advanced)
```bash
# Execute SQL from CRON_JOBS.md → "Option 3"
# Paste into SQL Editor in Supabase Dashboard
# Execute

# Verify
supabase sql -c "SELECT * FROM cron.job;"
```

**Verify cron setup:**
```bash
# Option A (GitHub): Check Actions tab → Workflows → run logs
# Option B (Vercel): Dashboard → Project → Functions → Cron logs
# Option C (Supabase): SQL Editor → SELECT * FROM cron.job_run_details
```

## Post-Deployment (After deployment)

### Immediate Checks (30 minutes)

```bash
# 1. Frontend loads without errors
# Navigate to http://your-app.com/bulk-upload
# Check browser console - should be empty

# 2. Backend API responds
curl https://your-api.com/api/health
# Should return: {"status":"ok"}

# 3. Test detection job
# Upload test image in UI
# Job should appear in database
psql $DATABASE_URL -c "SELECT id, status, progress FROM detection_jobs ORDER BY created_at DESC LIMIT 1;"

# 4. Check logs for errors
# Backend logs should show job processing
# Frontend console should be clear
# Supabase logs should be clean
```

### Monitoring (1-2 hours)

```bash
# Watch error rate
SELECT COUNT(*) as total, COUNT(CASE WHEN status='failed' THEN 1 END) as failed
FROM detection_jobs
WHERE created_at > NOW() - INTERVAL '1 hour';

# Watch error codes
SELECT error_code, COUNT(*) 
FROM detection_jobs 
WHERE status='failed' AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY error_code;

# Watch stage distribution
SELECT stage, COUNT(*) 
FROM detection_jobs 
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY stage;
```

### Production Testing (2-4 hours)

Follow test cases from `TESTING_DETECTION_SYSTEM.md`:

- [ ] Test successful detection (clear bookshelf image)
- [ ] Test error: invalid image (upload text file)
- [ ] Test error: timeout (if possible with large image)
- [ ] Test progress display (should be smooth 0→100%)
- [ ] Test progress doesn't go backwards
- [ ] Test error message displays correctly
- [ ] Test retry button appears only when canRetry: true
- [ ] Verify job appears in database with stage/error_code
- [ ] Test polling mechanism (2s intervals)

### User Communication (If necessary)

If any user-facing changes:
- [ ] Announce feature in release notes
- [ ] Update help documentation
- [ ] Prepare support team for questions

## Post-Deployment (24-48 hours)

### Monitor Key Metrics

```bash
# Success rate
SELECT 
  ROUND(100 * COUNT(CASE WHEN status='completed' THEN 1 END) / COUNT(*), 1) as success_rate
FROM detection_jobs
WHERE created_at > NOW() - INTERVAL '24 hours';

# Average processing time by stage
SELECT 
  stage,
  ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))), 1) as avg_seconds
FROM detection_jobs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY stage
ORDER BY avg_seconds DESC;

# Error rate
SELECT 
  error_code,
  COUNT(*) as count,
  ROUND(100 * COUNT(*) / (SELECT COUNT(*) FROM detection_jobs WHERE status='failed' AND created_at > NOW() - INTERVAL '24 hours'), 1) as pct
FROM detection_jobs
WHERE status='failed' AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY error_code
ORDER BY count DESC;
```

### Verify Automated Jobs

```bash
# Check cleanup job ran
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-detection-jobs')
ORDER BY start_time DESC LIMIT 5;

# Check timeout detection ran
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'mark-jobs-as-failed-if-stuck')
ORDER BY start_time DESC LIMIT 10;

# Verify cleanup actually deleted jobs
SELECT COUNT(*) as deleted_today
FROM detection_jobs
WHERE is_deleted AND deleted_at > NOW() - INTERVAL '24 hours';
```

### Performance Tuning

If issues observed:

```bash
# If TIMEOUT errors increasing:
# - Increase DETECTION_JOB_TIMEOUT_MINUTES from 10 to 15
# - Update timeout check function

# If OCR taking too long:
# - Monitor extracting_text stage duration
# - Consider reducing image max size
# - Check if Google Cloud Vision is throttled

# If memory usage high:
# - Check thumbnail compression
# - Reduce image quality settings
# - Increase cleanup frequency
```

## Rollback Procedure (If needed)

### Immediate Rollback (within hours)

```bash
# 1. Revert backend code
git revert HEAD~2
git push origin main
# Wait for redeploy

# 2. Revert frontend code
git revert HEAD~1
git push origin main
# Wait for redeploy

# 3. Disable cron jobs
# GitHub: Disable workflows
# Vercel: Disable functions
# Supabase: Drop cron jobs (if using pg_cron)

# 4. System should work with old detection behavior
```

### Delayed Rollback (after 1+ days)

```bash
# If migration needs to be reversed (careful):
supabase migration down

# This will:
# - Remove new columns (loss of data!)
# - Reset constraints
# - Should not affect existing data

# Verify:
psql $DATABASE_URL -c "\d detection_jobs"
# Should show old schema without new columns
```

## Troubleshooting Deployment

| Issue | Solution |
|-------|----------|
| Migration fails | Check if column already exists, check user permissions |
| Cron not running | Verify schedule syntax on crontab.guru, check firewall |
| Storage bucket 403 | Run RLS policies, check service role permissions |
| Functions timeout | Increase timeout settings, check function code |
| High error rate | Check logs, verify API keys, test manually |
| Jobs stuck processing | Check timeout detection cron, verify it's running |

## Success Criteria

✅ Deployment is successful if:

- [ ] No critical errors in logs (first 4 hours)
- [ ] Success rate >90% (first 24 hours)
- [ ] Progress bar smooth (0→100%, no backwards)
- [ ] Error messages display correctly
- [ ] Retry button shows/hides correctly
- [ ] Cron jobs execute successfully
- [ ] No database constraint violations
- [ ] Users can complete detection flow end-to-end
- [ ] No performance degradation

## Next Steps

1. **Monitor** for 24-48 hours
2. **Collect** feedback from users
3. **Adjust** timeout thresholds if needed
4. **Document** any issues found
5. **Plan** Phase 3 (multi-image UI enhancements)
6. **Plan** Phase 4 (advanced features)

---

**Deployment Estimated Duration**: 3-4 hours  
**Risk Level**: Low (migration is additive, code is isolated)  
**Rollback Time**: <10 minutes  
**Downtime Required**: None (gradual rollout)

For questions, refer to:
- `IMPLEMENTATION_SUMMARY.md` - Full context
- `QUICK_REFERENCE.md` - Common tasks
- `TESTING_DETECTION_SYSTEM.md` - Test cases
- `STORAGE_SETUP.md` - Storage issues
- `CRON_JOBS.md` - Cron configuration
