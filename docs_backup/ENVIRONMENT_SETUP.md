# Environment Separation Setup Guide

## Overview
This guide documents the multi-environment setup for the Community Library application.

**Status:** ✅ Git branches created, Supabase & Vercel configuration pending

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Repository                          │
├─────────────────────────────────────────────────────────────┤
│  main (development)           production (stable)             │
│    ↓                              ↓                          │
│  [Dev Env]                    [Prod Env]                     │
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

## Git Branches

### Main Branch (Development)
- **Branch:** `main`
- **Purpose:** Active development, can be unstable
- **Deploys to:** Vercel Preview Environment
- **Database:** Supabase Dev Project (to be created)
- **Domain:** `dev.communitylibrary.vercel.app` (custom prefix)

### Production Branch (Stable)
- **Branch:** `production` ✅ Created
- **Purpose:** Production-ready, stable releases
- **Deploys to:** Vercel Production Environment
- **Database:** Supabase Production Project (current)
- **Domain:** `communitylibrary.vercel.app`

---

## Supabase Configuration

### Production Database (Current - Keep As Is)
```
Project: community-library-prod (vhrijhxifulyurrxxrvm)
URL: https://vhrijhxifulyurrxxrvm.supabase.co
```

**Environment Variables (Production):**
- `SUPABASE_URL`: https://vhrijhxifulyurrxxrvm.supabase.co
- `SUPABASE_ANON_KEY`: [current prod key]
- `SUPABASE_SERVICE_ROLE_KEY`: [current prod service key]
- `POSTGRES_URL`: [current prod connection]

### Development Database (To Be Created)

**Manual Steps Required:**

1. **Create New Supabase Project**
   - Go to https://supabase.com/dashboard
   - Click "New Project"
   - Name: `community-library-dev`
   - Database Password: [generate strong password]
   - Region: Same as production (for consistency)
   - Plan: Free tier

2. **Copy Database Schema**
   - Navigate to SQL Editor in new project
   - Run all migration files from `database/` folder in order:
     ```sql
     -- Run each file in order:
     -- 001_initial_schema.sql
     -- 002_add_book_catalog.sql
     -- 003_add_users_insert_policy.sql
     -- 004_add_rating_to_reviews.sql
     -- etc.
     ```

3. **Copy Production Data (Optional)**
   - Export data from production using SQL Editor:
     ```sql
     -- Export families (sanitize emails/phones)
     SELECT 
       id, 
       name, 
       'dev-' || phone as phone,
       'dev-' || whatsapp as whatsapp,
       'dev-' || email as email,
       created_at
     FROM families;
     
     -- Export users (sanitize emails)
     SELECT 
       id,
       'dev-' || email as email,
       'dev-' || auth_email as auth_email,
       full_name,
       'dev-' || phone as phone,
       family_id,
       is_family_admin,
       created_at
     FROM users;
     
     -- Copy books, reviews, likes (can copy as-is)
     ```
   - Import into dev database

4. **Create Test Users**
   - Create 2-3 test families with test users
   - Use simple passwords for dev (e.g., "Test123!")
   - Document credentials in team password manager

5. **Get New Credentials**
   - Copy API URL
   - Copy anon key
   - Copy service role key
   - Copy connection strings

**Expected Environment Variables (Development):**
```bash
SUPABASE_URL=https://[dev-project-ref].supabase.co
SUPABASE_ANON_KEY=[dev-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[dev-service-key]
POSTGRES_URL=postgres://postgres.[dev-ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
POSTGRES_URL_NON_POOLING=postgres://postgres.[dev-ref]:[password]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

---

## Vercel Configuration

### Single Project, Multiple Environments

**Manual Steps Required:**

1. **Configure Git Integration**
   - Go to Vercel Dashboard → Your Project → Settings → Git
   - Production Branch: Set to `production` ✅
   - This makes `production` branch deploy to production environment
   - All other branches (including `main`) deploy to preview environments

2. **Configure Environment Variables - Production**
   - Go to Settings → Environment Variables
   - For each variable, select **Production** environment:
   
   ```bash
   # Database (Production)
   POSTGRES_URL=[current prod URL]
   POSTGRES_URL_NON_POOLING=[current prod URL]
   SUPABASE_URL=https://vhrijhxifulyurrxxrvm.supabase.co
   SUPABASE_ANON_KEY=[current prod key]
   SUPABASE_SERVICE_ROLE_KEY=[current prod service key]
   
   # AI Services (Production)
   GEMINI_API_KEY=[current key]
   OPENAI_API_KEY=[current key]
   GOOGLE_APPLICATION_CREDENTIALS=[current key]
   
   # Environment Identifier
   NODE_ENV=production
   ENVIRONMENT=production
   ```

3. **Configure Environment Variables - Preview (Dev)**
   - For each variable, select **Preview** environment:
   
   ```bash
   # Database (Development - from new Supabase project)
   POSTGRES_URL=[new dev URL]
   POSTGRES_URL_NON_POOLING=[new dev URL]
   SUPABASE_URL=[new dev URL]
   SUPABASE_ANON_KEY=[new dev key]
   SUPABASE_SERVICE_ROLE_KEY=[new dev service key]
   
   # AI Services (can share keys)
   GEMINI_API_KEY=[same as prod]
   OPENAI_API_KEY=[same as prod]
   GOOGLE_APPLICATION_CREDENTIALS=[same as prod]
   
   # Environment Identifier
   NODE_ENV=development
   ENVIRONMENT=development
   ```

4. **Configure Custom Domain Prefix (Optional)**
   - Vercel automatically gives previews URLs like: `community-library-git-main.vercel.app`
   - If you want custom subdomain: Go to Settings → Domains
   - Add: `dev.yourdomain.com` pointing to preview branches
   - Or use Vercel's automatic preview URLs

---

## Local Development

### Update Local Environment File

Update `.env.development.local` to use dev database:

```bash
# Switch from production to development database
POSTGRES_URL=[dev database URL]
POSTGRES_URL_NON_POOLING=[dev database URL]
SUPABASE_URL=[dev Supabase URL]
SUPABASE_ANON_KEY=[dev anon key]
SUPABASE_SERVICE_ROLE_KEY=[dev service key]

# AI Services (same as prod)
GEMINI_API_KEY=[key]
OPENAI_API_KEY=[key]
GOOGLE_APPLICATION_CREDENTIALS=[key]

# Environment
NODE_ENV=development
ENVIRONMENT=development
```

**⚠️ CRITICAL:** After updating, pull from Vercel:
```bash
npx vercel env pull .env.development.local --environment=preview
```

---

## Code Changes

### Files Modified:
1. ✅ `api/index.js` - Added environment logging
2. ✅ `vercel.json` - Added environment-specific configuration
3. ✅ `ENVIRONMENT_SETUP.md` - This documentation

### Environment Detection
The API now logs environment information on startup:
```javascript
const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'development';
console.log(`🚀 API starting in ${environment.toUpperCase()} environment`);
console.log(`📊 Database: ${dbIdentifier}`);
console.log(`🔧 AI Service: ${serviceName}`);
```

### Health Check Endpoint
Updated to include environment information:
```bash
GET /api/health

Response:
{
  "status": "ok",
  "message": "Community Library API is running",
  "environment": "production",
  "database": "vhrijhxifulyurrxxrvm"
}
```

---

## Deployment Workflow

### Development Workflow (main branch)
```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Make changes and commit
git add .
git commit -m "feat: add new feature"

# 3. Push to main
git checkout main
git merge feature/new-feature
git push origin main

# 4. Vercel auto-deploys to preview environment
# URL: https://community-library-git-main.vercel.app
# Uses: Dev database (isolated from production)
```

### Production Deployment (production branch)
```bash
# 1. Ensure main is thoroughly tested on preview
# 2. Merge main to production
git checkout production
git merge main

# 3. Push to production
git push origin production

# 4. Vercel auto-deploys to production
# URL: https://communitylibrary.vercel.app
# Uses: Production database (real data)
```

### Database Migration Workflow
```bash
# 1. Create migration file
# database/migrations/XXX_description.sql

# 2. Test on dev database first
# Apply to dev Supabase project via SQL Editor

# 3. Deploy to main branch, verify on preview

# 4. When ready, apply to production database
# Then merge to production branch
```

---

## Testing Environments

### Test Production Environment
```bash
# Check health endpoint
curl https://communitylibrary.vercel.app/api/health

# Expected response:
{
  "status": "ok",
  "environment": "production",
  "database": "vhrijhxifulyurrxxrvm"
}
```

### Test Development Environment
```bash
# Check health endpoint
curl https://community-library-git-main.vercel.app/api/health

# Expected response:
{
  "status": "ok",
  "environment": "development",
  "database": "[dev-project-ref]"
}
```

### Test Local Environment
```bash
npm start

# Check health endpoint
curl http://localhost:3001/api/health

# Expected response:
{
  "status": "ok",
  "environment": "development",
  "database": "[dev-project-ref]"
}
```

---

## Security Checklist

- [ ] Production database credentials never in code
- [ ] Development database has separate credentials
- [ ] `.env.development.local` in `.gitignore`
- [ ] Vercel environment variables configured correctly
- [ ] Production branch protected (optional)
- [ ] Dev database contains no real user data (sanitized)
- [ ] Different API keys for dev/prod (optional but recommended)

---

## Troubleshooting

### Issue: Local development connects to production
**Solution:** Update `.env.development.local` with dev database credentials

### Issue: Preview deployment uses production database
**Solution:** Check Vercel environment variables are set for Preview environment

### Issue: Database migration applied to wrong database
**Solution:** Always verify database URL before running migrations:
```bash
echo $POSTGRES_URL
```

### Issue: Environment variable not available in Vercel
**Solution:** Redeploy after setting environment variables:
```bash
vercel --prod  # or vercel for preview
```

---

## Cost Analysis

### Supabase
- **Production:** Free tier (current)
- **Development:** Free tier (new project)
- **Total:** $0/month (within free tier limits)

### Vercel
- **Project:** 1 project with unlimited previews
- **Bandwidth:** Hobby plan includes generous limits
- **Total:** $0/month (Hobby plan)

### AI Services
- **Gemini:** Shared between environments
- **OpenAI:** Shared between environments
- **Google Cloud:** Shared between environments

**Total Monthly Cost:** $0 (within free tiers)

---

## Next Steps

### Immediate Actions Required:

1. **Create Dev Supabase Project** (10 minutes)
   - [ ] Create project at https://supabase.com/dashboard
   - [ ] Name: `community-library-dev`
   - [ ] Run all migrations
   - [ ] Create test data
   - [ ] Save credentials

2. **Configure Vercel** (5 minutes)
   - [ ] Set production branch to `production`
   - [ ] Add production environment variables
   - [ ] Add preview environment variables
   - [ ] Verify auto-deploy works

3. **Update Local Development** (2 minutes)
   - [ ] Update `.env.development.local` with dev database
   - [ ] Test local connection
   - [ ] Verify `npm start` works

4. **Test Both Environments** (5 minutes)
   - [ ] Push to `main`, verify preview deployment
   - [ ] Check health endpoint shows dev database
   - [ ] Push to `production`, verify prod deployment
   - [ ] Check health endpoint shows prod database

### Optional Enhancements:

- Set up branch protection rules on GitHub
- Configure Vercel deployment notifications
- Add database backup automation
- Set up monitoring/alerts for both environments
- Create E2E tests that run on preview deployments
- Add database seeding scripts for dev environment

---

## References

- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Vercel Git Integration](https://vercel.com/docs/concepts/git)
- [Supabase Projects](https://supabase.com/docs/guides/platform/projects)
- [GitHub Branch Protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)

---

*Last Updated: November 27, 2025*
*Status: Git branches created ✅ | Supabase pending ⏳ | Vercel pending ⏳*
