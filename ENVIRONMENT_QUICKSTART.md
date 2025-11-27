# Environment Separation - Quick Start Guide

## ✅ What's Been Done

1. **Git Branches Created**
   - ✅ `production` branch - for stable production releases
   - ✅ `main` branch - for active development (existing)

2. **Code Changes Applied**
   - ✅ API now detects and logs environment on startup
   - ✅ Health check endpoint includes environment info
   - ✅ Vercel.json configured for multi-branch deployment

3. **Documentation Created**
   - ✅ `ENVIRONMENT_SETUP.md` - Complete setup guide
   - ✅ Helper scripts for environment management

---

## 🚀 Next Steps (Required)

### Step 1: Create Dev Supabase Project (10 minutes)

1. Go to https://supabase.com/dashboard
2. Click **"New Project"**
3. Fill in:
   - **Name:** `community-library-dev`
   - **Database Password:** Generate a strong password (save it!)
   - **Region:** Same as production (for consistency)
   - **Plan:** Free tier
4. Wait for project creation (~2 minutes)
5. **Save these credentials** (found in Settings → API):
   ```
   Project URL: https://[project-ref].supabase.co
   Anon Key: eyJ...
   Service Role Key: eyJ...
   ```
6. Go to Settings → Database → Connection String
7. **Save these connection strings:**
   ```
   Connection pooling: postgres://postgres.[ref]:[password]@...pooler.supabase.com:6543/postgres
   Direct connection: postgres://postgres.[ref]:[password]@...pooler.supabase.com:5432/postgres
   ```

### Step 2: Copy Database Schema to Dev (5 minutes)

1. In dev project, go to **SQL Editor**
2. Run each migration file in order from `database/migrations/`:
   - `001_initial_schema.sql`
   - `002_add_book_catalog.sql`
   - `003_add_users_insert_policy.sql`
   - Any other migration files
3. Verify tables created: Go to **Table Editor** and check tables exist

### Step 3: Create Test Data in Dev (5 minutes)

Run this SQL in dev project's SQL Editor:

```sql
-- Create test family
INSERT INTO families (id, name, email, phone, whatsapp)
VALUES (
  'f1111111-1111-1111-1111-111111111111',
  'משפחת טסט',
  'test@example.com',
  '050-1111111',
  '050-1111111'
);

-- Create test user (note: password = Test123!)
-- First create auth user in Authentication → Add User
-- Email: test@example.com, Password: Test123!
-- Then copy the auth ID and use it below:

INSERT INTO users (id, auth_id, email, auth_email, full_name, phone, family_id, is_family_admin)
VALUES (
  'u1111111-1111-1111-1111-111111111111',
  '[paste-auth-user-id-here]',
  'test@example.com',
  'test@example.com',
  'משתמש טסט',
  '050-1111111',
  'f1111111-1111-1111-1111-111111111111',
  true
);
```

### Step 4: Configure Vercel (10 minutes)

1. **Set GitHub Default Branch:**
   - Go to your GitHub repository: https://github.com/yinonoshrat/CommunityLibrary
   - Click **Settings** (repository settings, not your profile)
   - In the left sidebar, click **Branches**
   - Under "Default branch", click the ↔️ switch icon
   - Select `production` from the dropdown
   - Click **Update** and confirm
   - ⚠️ **This makes `production` deploy to your main domain (communitylibrary.vercel.app)**
   - All other branches (including `main`) will deploy as previews

2. **Configure Vercel Environment Variables:**
   - Go to https://vercel.com/dashboard
   - Select your `community-library` project
   - Go to **Settings → Environment Variables**

**For Production Environment:**
- Click **Add New**
- For each variable below, select **Production** environment:

```bash
POSTGRES_URL = [your current production URL]
POSTGRES_URL_NON_POOLING = [your current production URL]
SUPABASE_URL = https://vhrijhxifulyurrxxrvm.supabase.co
SUPABASE_ANON_KEY = [your current production key]
SUPABASE_SERVICE_ROLE_KEY = [your current production service key]
GEMINI_API_KEY = [your current key]
OPENAI_API_KEY = [your current key]
GOOGLE_APPLICATION_CREDENTIALS = [your current key]
ENVIRONMENT = production
NODE_ENV = production
```

**For Preview Environment (Dev):**
- For each variable below, click **Add New** and select **Preview** environment:

```bash
POSTGRES_URL = [dev project connection pooling URL from Step 1]
POSTGRES_URL_NON_POOLING = [dev project direct URL from Step 1]
SUPABASE_URL = [dev project URL from Step 1]
SUPABASE_ANON_KEY = [dev anon key from Step 1]
SUPABASE_SERVICE_ROLE_KEY = [dev service key from Step 1]
GEMINI_API_KEY = [same as production - can share]
OPENAI_API_KEY = [same as production - can share]
GOOGLE_APPLICATION_CREDENTIALS = [same as production - can share]
ENVIRONMENT = development
NODE_ENV = development
```

### Step 5: Update Local Development (2 minutes)

Option A - Use Helper Script:
```powershell
cd c:\Git\CommunityLibrary
.\scripts\update-local-env.ps1
# Follow prompts and paste dev database credentials
```

Option B - Manual:
1. Open `.env.development.local`
2. Replace all Supabase URLs with dev project URLs (from Step 1)
3. Add these lines:
   ```bash
   ENVIRONMENT=development
   NODE_ENV=development
   ```

### Step 6: Test Everything (10 minutes)

**Test Local Development:**
```powershell
npm start
# Open: http://localhost:5174
# Check API: http://localhost:3001/api/health
# Should show: "environment": "development"
```

**Test Dev Deployment:**
```powershell
git push origin main
# Wait for Vercel deployment (~2 minutes)
# Check: https://community-library-git-main-[your-vercel-slug].vercel.app/api/health
# Should show: "environment": "development"
```

**Test Production Deployment:**
```powershell
git checkout production
git push origin production
# Wait for Vercel deployment (~2 minutes)
# Check: https://communitylibrary.vercel.app/api/health
# Should show: "environment": "production"
```

---

## 📋 Daily Development Workflow

### Working on Features
```bash
# Always start from main (development)
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/my-feature

# Make changes, test locally
npm start

# Commit and push
git add .
git commit -m "feat: add my feature"
git push origin feature/my-feature

# Merge to main for dev deployment
git checkout main
git merge feature/my-feature
git push origin main
# ✅ Auto-deploys to dev environment (preview URL)
```

### Deploying to Production
```bash
# After thorough testing on dev environment
git checkout production
git merge main
git push origin production
# ✅ Auto-deploys to production environment
```

---

## 🔍 Quick Health Checks

### Check Current Environment
```bash
# Local
curl http://localhost:3001/api/health

# Dev (replace with your preview URL)
curl https://community-library-git-main.vercel.app/api/health

# Production
curl https://communitylibrary.vercel.app/api/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "Community Library API is running",
  "environment": "development",  // or "production"
  "database": "[project-ref]",
  "timestamp": "2025-11-27T..."
}
```

---

## 📞 Need Help?

- **Full Documentation:** See `ENVIRONMENT_SETUP.md`
- **Migration Help:** Run `.\scripts\migrate-database.ps1`
- **Environment Issues:** Check Vercel environment variables
- **Database Issues:** Verify Supabase project URLs

---

## ⚠️ Important Notes

1. **Never commit `.env.development.local`** - contains sensitive credentials
2. **Always test on dev first** - before merging to production
3. **Production data is real** - be careful with production database
4. **Dev and prod databases are isolated** - changes to dev don't affect production
5. **API keys can be shared** - or use separate keys for cost tracking

---

*Setup Time: ~30 minutes total*
*Status: Git ✅ | Code ✅ | Supabase ⏳ | Vercel ⏳ | Local ⏳*
