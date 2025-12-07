# Supabase Edge Function Configuration

## Purpose
This edge function handles async book detection from images with a 150-second timeout (vs Vercel's 60s limit).

## Setup Instructions

### 1. Install Supabase CLI
```bash
npm install -g supabase
```

### 2. Link to Your Project
```bash
# Login to Supabase
npx supabase login

# Link to your project (get project-ref from dashboard URL)
npx supabase link --project-ref <your-project-ref>
```

### 3. Set Environment Variables
The edge function needs these environment variables (automatically available in Supabase):
- `SUPABASE_URL` - Auto-provided
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-provided  
- `GEMINI_API_KEY` - **YOU MUST ADD THIS**

Add the Gemini API key:
```bash
npx supabase secrets set GEMINI_API_KEY=your_gemini_api_key_here
```

Or via Supabase Dashboard:
1. Go to Project Settings → Edge Functions → Secrets
2. Add `GEMINI_API_KEY` with your API key

### 4. Deploy the Function
```bash
# Deploy from repository
npx supabase functions deploy detect-books

# Or deploy with no JWT verification (if using service role calls)
npx supabase functions deploy detect-books --no-verify-jwt
```

### 5. Get the Function URL
After deployment, you'll get a URL like:
```
https://<project-ref>.supabase.co/functions/v1/detect-books
```

Save this URL - you'll need it in your Vercel environment variables.

### 6. Configure Vercel Environment Variable
Add to Vercel (Dashboard → Settings → Environment Variables):
```
SUPABASE_EDGE_FUNCTION_URL=https://<project-ref>.supabase.co/functions/v1/detect-books
```

## Deployment from GitHub (Recommended)

### Option A: Manual Deployment
Keep the code in this repository and deploy manually when changes are made:
```bash
cd c:\Git\CommunityLibrary
npx supabase functions deploy detect-books
```

### Option B: GitHub Actions (Automated)
Create `.github/workflows/deploy-supabase-functions.yml`:

```yaml
name: Deploy Supabase Functions

on:
  push:
    branches:
      - main
    paths:
      - 'supabase/functions/**'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest
      
      - name: Deploy Edge Functions
        run: npx supabase functions deploy detect-books --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

Then add GitHub secrets:
- `SUPABASE_PROJECT_REF` - Your project ref
- `SUPABASE_ACCESS_TOKEN` - Get from Supabase Dashboard → Account → Access Tokens

## Testing the Edge Function

### Test Locally (Optional)
```bash
# Start local Supabase
npx supabase start

# Serve function locally
npx supabase functions serve detect-books --env-file .env.local

# Test with curl
curl -i --location --request POST 'http://localhost:54321/functions/v1/detect-books' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"jobId":"test-123","imageData":"base64_image_data_here"}'
```

### Test in Production
The edge function is called automatically by the Vercel API when a detection job is created.

## Monitoring

### View Logs
```bash
# Real-time logs
npx supabase functions logs detect-books --follow

# Recent logs
npx supabase functions logs detect-books
```

### Dashboard
View logs and metrics in Supabase Dashboard:
- Edge Functions → detect-books → Logs
- Edge Functions → detect-books → Metrics

## Architecture

```
User Upload Image
    ↓
Vercel API (/api/books/detect-from-image)
    ↓
1. Create job in detection_jobs table
2. Call Supabase Edge Function (async)
3. Return jobId immediately
    ↓
Supabase Edge Function (150s timeout)
    ↓
1. Gemini Vision API (60-90s)
2. Simania Book Search (parallel, 30-40s)
3. Deduplicate & sort results
4. Update job with results
    ↓
Frontend polls /api/books/detect-job/:jobId
    ↓
Display results to user
```

## Troubleshooting

### Error: "Invalid API key"
- Check `GEMINI_API_KEY` secret is set: `npx supabase secrets list`
- Verify key is valid at https://makersuite.google.com/app/apikey

### Error: "Function not found"
- Verify deployment: `npx supabase functions list`
- Check function URL is correct in Vercel env vars

### Timeout Issues
- Edge functions have 150s timeout (enough for most images)
- For very large images, consider reducing image size before upload

### Database Connection Issues
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
- Check RLS policies on `detection_jobs` table

## Cost Estimation

### Supabase Edge Functions
- **Free tier**: 500K invocations/month, 1GB egress
- **Typical usage**: ~3-5 invocations per book detection
- **Expected cost**: Free for most users

### Gemini API
- **Free tier**: 15 requests/minute, 1500 requests/day
- **Cost after free**: ~$0.001-0.01 per image
- **Optimization**: Use `gemini-2.0-flash-exp` (fastest, cheapest)

## Updates and Maintenance

To update the function:
1. Edit `supabase/functions/detect-books/index.ts`
2. Commit and push to GitHub
3. Deploy: `npx supabase functions deploy detect-books`

Or if using GitHub Actions, just push to `main` branch.
