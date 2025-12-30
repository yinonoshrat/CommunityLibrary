# Cron Job Configuration for Detection Job Maintenance

This document describes how to set up automated cron jobs to clean up old detection jobs and handle timeout scenarios.

## Overview

Two cron jobs are needed:

1. **Cleanup Detection Jobs** - Runs daily at 2 AM UTC
   - Deletes images from storage
   - Soft-deletes jobs from database
   - Frees up storage space

2. **Timeout Check** - Runs every 5 minutes
   - Finds jobs stuck in 'processing' for >10 minutes
   - Marks them as failed with error code 'TIMEOUT'
   - Allows users to retry

## Prerequisites

1. Supabase Functions deployed:
   - `cleanup-detection-jobs` function
   - `mark-jobs-as-failed-if-stuck` function
2. Service role key available (`SUPABASE_SERVICE_ROLE_KEY`)
3. Cron job scheduler (Vercel, GitHub Actions, or Supabase pg_cron)

## Option 1: GitHub Actions (Recommended for Vercel deployments)

### Setup

1. Create `.github/workflows/detection-cleanup.yml`:

```yaml
name: Detection Job Cleanup & Timeout Check

on:
  schedule:
    # Cleanup every day at 2 AM UTC
    - cron: '0 2 * * *'
    # Timeout check every 5 minutes
    - cron: '*/5 * * * *'

jobs:
  cleanup:
    runs-on: ubuntu-latest
    # Only run cleanup job once per day (at 2 AM UTC)
    if: github.event.schedule == '0 2 * * *'
    
    steps:
      - name: Run detection job cleanup
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            https://${{ secrets.SUPABASE_PROJECT_ID }}.functions.supabase.co/functions/v1/cleanup-detection-jobs \
            -d '{}'
        
        continue-on-error: true

  timeout-check:
    runs-on: ubuntu-latest
    # Run timeout check every 5 minutes
    if: github.event.schedule == '*/5 * * * *'
    
    steps:
      - name: Check for stale processing jobs
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            https://${{ secrets.SUPABASE_PROJECT_ID }}.functions.supabase.co/functions/v1/mark-jobs-as-failed-if-stuck \
            -d '{}'
        
        continue-on-error: true
```

2. Add secrets to GitHub Actions:
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
   - `SUPABASE_PROJECT_ID` - Your Supabase project ID

### Testing

```bash
# Test cleanup job
curl -X POST \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  https://YOUR_PROJECT_ID.functions.supabase.co/functions/v1/cleanup-detection-jobs

# Test timeout check
curl -X POST \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  https://YOUR_PROJECT_ID.functions.supabase.co/functions/v1/mark-jobs-as-failed-if-stuck
```

## Option 2: Vercel Cron Functions

### Setup

1. Create `api/cron/detection-cleanup.ts`:

```typescript
// api/cron/detection-cleanup.ts
export const config = {
  runtime: 'nodejs',
  regions: ['iad1'],
};

export default async (req: Request): Promise<Response> => {
  // Verify cron secret
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = `https://${process.env.SUPABASE_PROJECT_ID}.functions.supabase.co/functions/v1/cleanup-detection-jobs`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Cleanup failed: ${data.error}`);
    }

    return new Response(
      JSON.stringify({ success: true, ...data }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Cleanup error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
```

2. Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/detection-cleanup",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/detection-timeout-check",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

3. Set `CRON_SECRET` in Vercel project settings (use a random string)

## Option 3: Supabase pg_cron Extension

### Setup

1. Enable `pg_cron` extension in Supabase:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres user
GRANT USAGE ON SCHEMA cron TO postgres;
```

2. Create cleanup job:

```sql
-- Schedule cleanup job daily at 2 AM UTC
SELECT cron.schedule(
  'cleanup-detection-jobs',
  '0 2 * * *',
  $$
    SELECT http_post(
      'https://YOUR_PROJECT_ID.functions.supabase.co/functions/v1/cleanup-detection-jobs',
      '{}'::jsonb,
      jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
        'Content-Type', 'application/json'
      )
    )
  $$
);
```

3. Create timeout check job:

```sql
-- Schedule timeout check every 5 minutes
SELECT cron.schedule(
  'mark-jobs-as-failed-if-stuck',
  '*/5 * * * *',
  $$
    SELECT http_post(
      'https://YOUR_PROJECT_ID.functions.supabase.co/functions/v1/mark-jobs-as-failed-if-stuck',
      '{}'::jsonb,
      jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
        'Content-Type', 'application/json'
      )
    )
  $$
);
```

Note: Requires `http` extension and proper configuration

## Option 4: External Service (e.g., AWS Lambda, Google Cloud Functions)

### AWS Lambda Example

1. Create Lambda function `detection-cleanup`:

```python
import json
import os
import urllib.request

def lambda_handler(event, context):
    url = f"https://{os.environ['SUPABASE_PROJECT_ID']}.functions.supabase.co/functions/v1/cleanup-detection-jobs"
    
    headers = {
        'Authorization': f"Bearer {os.environ['SUPABASE_SERVICE_ROLE_KEY']}",
        'Content-Type': 'application/json'
    }
    
    req = urllib.request.Request(url, data=json.dumps({}).encode(), headers=headers, method='POST')
    
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read())
            return {
                'statusCode': 200,
                'body': json.dumps(data)
            }
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
```

2. Configure EventBridge triggers:
   - Cleanup: `cron(0 2 * * ? *)`
   - Timeout check: `cron(*/5 * * * ? *)`

## Monitoring & Debugging

### View Cron Job Logs

**GitHub Actions:**
```
GitHub → Settings → Secrets → Actions logs → Workflow runs
```

**Vercel:**
```
Vercel Dashboard → Project → Deployments → Functions → Cron logs
```

**Supabase:**
```sql
-- View pg_cron job history
SELECT * FROM cron.job;
SELECT * FROM cron.job_run_details;
```

### Manual Testing

```bash
#!/bin/bash

SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
PROJECT_ID="YOUR_PROJECT_ID"

echo "=== Testing Cleanup Job ==="
curl -X POST \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  https://$PROJECT_ID.functions.supabase.co/functions/v1/cleanup-detection-jobs \
  -d '{}' | jq .

echo ""
echo "=== Testing Timeout Check Job ==="
curl -X POST \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  https://$PROJECT_ID.functions.supabase.co/functions/v1/mark-jobs-as-failed-if-stuck \
  -d '{}' | jq .
```

## Troubleshooting

### Jobs not running

1. Check cron syntax: https://crontab.guru/
2. Verify credentials are correct
3. Check firewall/network policies
4. Review function logs for errors

### Jobs running but not cleaning up

1. Check if jobs are actually older than retention period
2. Verify database permissions (service role key)
3. Check if storage bucket exists
4. Review function error logs

### High costs from frequent runs

1. Increase timeout check interval (currently 5 minutes)
2. Reduce retention period (currently 7 days)
3. Batch process larger chunks of jobs
4. Use database-level cleanup (SQL triggers) instead of functions

## Cost Estimation

With default configuration:

- **GitHub Actions**: ~$0/month (included in free tier)
- **Vercel**: ~$0/month (included)
- **Supabase**: ~$0-50/month (depends on HTTP request volume)
  - 288 cleanup requests/month (1/day)
  - 8,640 timeout checks/month (every 5 min)
  - Total: ~9,000 API calls/month

## Next Steps

1. Choose cron job provider based on your deployment platform
2. Deploy Supabase functions
3. Configure cron schedule
4. Add secrets/environment variables
5. Test manually
6. Monitor logs for first week
7. Adjust schedule if needed
