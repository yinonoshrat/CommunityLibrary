# CommunityLibrary - Environment & Deployment Setup Guide

This guide covers everything needed to set up a new environment from scratch: Supabase, Vercel, and local development.

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Supabase Setup](#supabase-setup)
3. [Vercel Setup](#vercel-setup)
4. [Local Development Setup](#local-development-setup)
5. [OAuth Configuration](#oauth-configuration)
6. [Storage Setup](#storage-setup)
7. [Edge Functions & Cron Jobs](#edge-functions--cron-jobs)
8. [Environment Variables Reference](#environment-variables-reference)

---

## Prerequisites

### Required Accounts
- [GitHub](https://github.com) - Source code repository
- [Supabase](https://supabase.com) - Database, Auth, Storage
- [Vercel](https://vercel.com) - Hosting & serverless functions
- [Google Cloud Console](https://console.cloud.google.com) - For OAuth & AI APIs

### Required Tools
- Node.js v22.1.0+ 
- npm
- Git
- Vercel CLI: `npm i -g vercel`
- Supabase CLI: `npm i -g supabase`

---

## Supabase Setup

### 1. Create New Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click **New Project**
3. Configure:
   - **Name**: `community-library-[env]` (e.g., `community-library-prod`)
   - **Database Password**: Generate strong password (save it!)
   - **Region**: Choose closest to your users
   - **Plan**: Free tier works for development

### 2. Apply Database Schema

Run migrations in order in **SQL Editor**:

```sql
-- database/migrations/001_initial_schema.sql through latest
-- Or use the full schema:
-- database/schema.sql
```

Key tables:
- `families` - Family groups
- `users` - User accounts (links to Supabase Auth)
- `book_catalog` - Shared book metadata
- `family_books` - Family-owned copies
- `loans` - Loan transactions
- `reviews`, `likes` - Social features
- `detection_jobs` - AI book detection jobs

### 3. Enable Row Level Security (RLS)

RLS policies are included in migrations. Verify they're enabled:

```sql
-- Check RLS is enabled on all tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

### 4. Get Connection Credentials

From **Project Settings → Database**:
- **Connection string (pooler)**: Use for `POSTGRES_URL`
- **Connection string (direct)**: Use for `POSTGRES_URL_NON_POOLING`

From **Project Settings → API**:
- **Project URL**: Use for `SUPABASE_URL`
- **anon public key**: Use for `SUPABASE_ANON_KEY`
- **service_role key**: Use for `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep secret!)

---

## Vercel Setup

### 1. Import Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New → Project**
3. Import from GitHub repository
4. Configure:
   - **Framework Preset**: Other
   - **Root Directory**: `./` (project root)
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Output Directory**: `frontend/dist`

### 2. Configure Environment Variables

In **Project Settings → Environment Variables**, add:

#### Production Environment
| Variable | Value | Environment |
|----------|-------|-------------|
| `POSTGRES_URL` | From Supabase (pooler) | Production |
| `POSTGRES_URL_NON_POOLING` | From Supabase (direct) | Production |
| `SUPABASE_URL` | From Supabase | Production |
| `SUPABASE_ANON_KEY` | From Supabase | Production |
| `SUPABASE_SERVICE_ROLE_KEY` | From Supabase | Production |
| `GEMINI_API_KEY` | From Google AI Studio | Production |
| `VITE_SUPABASE_URL` | Same as SUPABASE_URL | Production |
| `VITE_SUPABASE_ANON_KEY` | Same as SUPABASE_ANON_KEY | Production |

#### Preview Environment (for dev branch)
Same variables but with dev Supabase project credentials.

### 3. Configure Git Integration

1. **Settings → Git → Production Branch**: Set to `production` or `main`
2. All other branches deploy to preview environments
3. Enable automatic deployments

### 4. Verify vercel.json

The `vercel.json` should have:
```json
{
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/dist",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api" }
  ]
}
```

---

## Local Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/YOUR_ORG/CommunityLibrary.git
cd CommunityLibrary
```

### 2. Install Dependencies

```bash
npm install                    # Root dependencies
cd frontend && npm install     # Frontend dependencies
cd ../api && npm install       # API dependencies
cd ../backend && npm install   # Backend wrapper
cd ..
```

### 3. Set Up Environment Variables

Option A - Pull from Vercel:
```bash
npx vercel env pull .env.development.local
```

Option B - Create manually:
```bash
# .env.development.local
POSTGRES_URL=postgres://...
POSTGRES_URL_NON_POOLING=postgres://...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GEMINI_API_KEY=AIza...
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### 4. Run Development Server

```bash
npm run dev
```

This starts:
- Frontend at http://localhost:5174
- Backend at http://localhost:3001

### 5. Verify Setup

1. Open http://localhost:5174
2. Register a new user
3. Create a family
4. Add a book

---

## OAuth Configuration

### Google OAuth Setup

1. **Google Cloud Console** → Create/Select Project
2. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
3. Configure:
   - **Application type**: Web application
   - **Authorized redirect URIs**:
     - `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
     - `http://localhost:5174/auth/callback` (for dev)
4. Copy Client ID and Secret

### Supabase OAuth Configuration

1. **Supabase Dashboard → Authentication → Providers**
2. Enable **Google**
3. Enter Client ID and Secret
4. **Authentication → URL Configuration**:
   - **Site URL**: `https://your-app.vercel.app`
   - **Redirect URLs**: Add all valid redirect URLs

---

## Storage Setup

### Create Storage Bucket

1. **Supabase Dashboard → Storage → New Bucket**
2. Configure:
   - **Name**: `detection-job-images`
   - **Public**: No (private bucket)
   - **File size limit**: 10 MB

### Storage RLS Policies

Apply via SQL Editor:

```sql
-- Users can upload to their own folder
CREATE POLICY "Users upload to own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    auth.uid()::text = (storage.foldername(name))[1]
    AND bucket_id = 'detection-job-images'
  );

-- Users can read their own images
CREATE POLICY "Users read own images"
  ON storage.objects FOR SELECT
  USING (
    auth.uid()::text = (storage.foldername(name))[1]
    AND bucket_id = 'detection-job-images'
  );

-- Users can delete their own images
CREATE POLICY "Users delete own images"
  ON storage.objects FOR DELETE
  USING (
    auth.uid()::text = (storage.foldername(name))[1]
    AND bucket_id = 'detection-job-images'
  );

-- Service role can manage all (for cleanup)
CREATE POLICY "Service role manages all"
  ON storage.objects FOR ALL
  USING (bucket_id = 'detection-job-images')
  WITH CHECK (bucket_id = 'detection-job-images');
```

---

## Edge Functions & Cron Jobs

### Deploy Edge Functions

```bash
# Link to Supabase project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy functions
supabase functions deploy cleanup-detection-jobs
supabase functions deploy mark-jobs-as-failed-if-stuck

# Set secrets
supabase secrets set CRON_SECRET=your-random-secret
```

### Vercel Cron Jobs

Cron jobs are defined in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-detection-jobs",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/check-job-timeouts",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

### Alternative: GitHub Actions

Create `.github/workflows/cron.yml` for scheduled maintenance.

---

## Environment Variables Reference

### Complete List

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_URL` | ✅ | Supabase connection string (with pooler) |
| `POSTGRES_URL_NON_POOLING` | ✅ | Direct connection (for migrations) |
| `SUPABASE_URL` | ✅ | Supabase API endpoint |
| `SUPABASE_ANON_KEY` | ✅ | Public API key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Admin key (server-side only!) |
| `GEMINI_API_KEY` | ✅ | Google Gemini API for AI detection |
| `VITE_SUPABASE_URL` | ✅ | Frontend Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Frontend Supabase key |
| `GOOGLE_CLOUD_CREDENTIALS` | Optional | Service account JSON for OCR |
| `OPENAI_API_KEY` | Optional | Alternative AI provider |
| `CRON_SECRET` | Optional | Secret for cron job authentication |

### Get API Keys

- **GEMINI_API_KEY**: https://aistudio.google.com/app/apikey
- **GOOGLE_CLOUD_CREDENTIALS**: Google Cloud Console → Service Accounts

---

## Multi-Environment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Repository                         │
├─────────────────────────────────────────────────────────────┤
│  main (development)           production (stable)            │
│    ↓                              ↓                          │
│  [Preview Env]                [Production Env]               │
└─────────────────────────────────────────────────────────────┘
         ↓                              ↓
    ┌─────────┐                   ┌─────────┐
    │ Vercel  │                   │ Vercel  │
    │ Preview │                   │  Prod   │
    └─────────┘                   └─────────┘
         ↓                              ↓
    ┌─────────┐                   ┌─────────┐
    │Supabase │                   │Supabase │
    │  Dev    │                   │  Prod   │
    └─────────┘                   └─────────┘
```

---

## Troubleshooting

### Common Issues

**"Cannot connect to database"**
- Verify `POSTGRES_URL` is correct
- Check Supabase project is active
- Ensure IP is not blocked (Supabase → Settings → Database → Connection Pooling)

**"401 Unauthorized" on API calls**
- Check `SUPABASE_ANON_KEY` is set correctly
- Verify JWT token is being sent in requests

**"RLS policy violation"**
- Review RLS policies in Supabase
- Check user has correct permissions
- Use service role key for admin operations

**"Vercel build failed"**
- Check build logs in Vercel dashboard
- Ensure all dependencies are in package.json
- Verify TypeScript has no errors: `npm run build`

**"AI detection not working"**
- Verify `GEMINI_API_KEY` is set
- Check API quota at Google AI Studio
- Look at server logs for specific errors
