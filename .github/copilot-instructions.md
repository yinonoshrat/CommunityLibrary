# CommunityLibrary - AI Agent Instructions

## Quick Reference

| What | Where |
|------|-------|
| API Code | `api/index.js` (single source of truth) |
| Frontend | `frontend/src/` (React + TypeScript + MUI) |
| Local Dev | `npm run dev` (frontend:5174 + backend:3001) |
| Deploy | Push to `main` → Vercel auto-deploys |
| Database | Supabase Postgres with RLS |
| Auth | Supabase Auth (Email/Password + Google OAuth) |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    CommunityLibrary                          │
├─────────────────────────────────────────────────────────────┤
│  frontend/          React + Vite + TypeScript + MUI         │
│  api/               Express.js (Vercel serverless)          │
│  backend/           Local dev wrapper (imports api/)        │
│  backend_shared_src/ Shared controllers, services, DB       │
│  database/          SQL migrations                          │
│  supabase/          Edge Functions                          │
└─────────────────────────────────────────────────────────────┘
```

### Critical: Shared Code Pattern

**`api/index.js`** is the single source of truth for API logic:
- Local dev: `backend/server.js` imports and runs it with `app.listen()`
- Vercel: Uses `api/index.js` directly as serverless function
- **Never duplicate route logic** between `api/` and `backend/`

---

## Development Commands

```bash
npm run dev              # Runs frontend (5174) + backend (3001)
npm run dev:frontend     # Frontend only
npm run dev:backend      # Backend only

# Testing
cd frontend && npm run test:e2e        # Playwright E2E tests
cd api && npm test                      # API unit tests

# Environment
npx vercel env pull .env.development.local  # Pull env vars from Vercel
```

---

## Project Patterns

### API Routes
All routes in `api/index.js` use `/api` prefix:
```javascript
app.get('/api/health', ...)
app.get('/api/books', ...)
app.post('/api/loans', ...)
```

### Frontend API Calls
```typescript
fetch('/api/books')  // Works in dev (proxy) and production (Vercel rewrites)
```

### TanStack Query Pattern
```typescript
// Hooks in frontend/src/hooks/
const { data, isLoading } = useBooks(filters)
const createLoan = useCreateLoan({ onSuccess: ... })
```

### Database Access
```javascript
// Use adapter pattern - backend_shared_src/db/adapter.js
import { supabase, pool } from '../db/adapter.js'
const { data } = await supabase.from('books').select('*')
```

---

## Hebrew UI Guidelines

- **All user-facing text in Hebrew**
- **RTL layout** (right-to-left)
- Icons on the RIGHT side of text
- Primary action buttons on RIGHT, cancel on LEFT
- Use Material-UI with `direction: 'rtl'`

### Common Hebrew Terms
| English | Hebrew |
|---------|--------|
| My Books | הספרים שלי |
| Add Book | הוסף ספר |
| Delete | מחק |
| Save | שמור |
| Cancel | ביטול |
| Loan/Lend | השאל |
| Return | החזר |
| Search | חיפוש |
| Family | משפחה |
| Profile | פרופיל |

---

## Common Tasks

### Adding a New API Endpoint
1. Add route in `api/index.js`
2. If complex, create controller in `backend_shared_src/controllers/`
3. Add tests in `api/__tests__/`
4. Test with `npm run dev`

### Adding a New Page
1. Create in `frontend/src/pages/NewPage.tsx`
2. Add route in `frontend/src/App.tsx`
3. Follow layout pattern:
```tsx
<Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
  <Typography variant="h4">כותרת</Typography>
  {/* Content */}
</Container>
```

### Adding Database Migration
1. Create file in `database/migrations/NNN_description.sql`
2. Run in Supabase SQL Editor
3. Update `database/schema.sql` for reference

---

## Testing Requirements

### API Tests (Required for each endpoint)
1. Happy path (200/201 response)
2. Missing required fields → 400 JSON error
3. Invalid data types → 400 JSON error  
4. Not found → 404 JSON error
5. Always verify `Content-Type: application/json`

### E2E Tests (Playwright)
- Location: `frontend/e2e/`
- Run: `cd frontend && npm run test:e2e`
- Always wait for elements with proper selectors
- Use `exact: true` for Hebrew text matching to avoid ambiguity
- Example: `getByRole('tab', { name: 'שאלתי', exact: true })`

---

## Code Quality Checklist

Before completing any task:
- [ ] No unused imports
- [ ] No TypeScript errors
- [ ] Tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] Hebrew text is correct
- [ ] RTL layout works

---

## Key Features Implementation

### Book Detection (AI Vision)
- Upload image → OCR + Gemini AI → Detect book titles
- Progress tracking through 6 stages (0-100%)
- Retry mechanism with error codes
- Files: `backend_shared_src/services/hybridVision.js`

### Loan System
- Frontend-generated UUIDs for optimistic updates
- Cache updates without full refetch
- Automatic book status updates
- Files: `frontend/src/hooks/useLoanMutations.ts`

### Authentication
- Supabase Auth (Email/Password + Google OAuth)
- Multiple users can share email (family members)
- `auth_email` field stores unique Auth identity
- Files: `frontend/src/contexts/AuthContext.tsx`

### Theme System
- 5 themes: Blue, Dark, Green, Purple, Orange
- Persisted in localStorage key: `communityLibrary_theme`
- Files: `frontend/src/themes.ts`, `frontend/src/contexts/ThemeContext.tsx`

---

## Environment Variables

### Backend (Required)
```
POSTGRES_URL=...              # Supabase pooler connection
POSTGRES_URL_NON_POOLING=...  # Direct connection (migrations)
SUPABASE_URL=...              # Supabase API URL
SUPABASE_ANON_KEY=...         # Public key
SUPABASE_SERVICE_ROLE_KEY=... # Admin key (server only)
GEMINI_API_KEY=...            # For AI book detection
```

### Frontend (VITE_ prefix required)
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

---

## When Uncertain

1. **Stop and ask** - Don't guess business logic
2. **Check existing patterns** - Look at similar code in the codebase
3. **Test incrementally** - Verify each step works
4. **Read error messages** - They usually explain the issue

---

## AI Agent Workflow Guidelines

### Code Quality
- **Clean imports**: Remove unused imports before completing tasks
- **TypeScript strict mode**: Ensure no TS errors (unused variables, missing types)
- **Run build verification**: After changes, verify with `npm run build`
- **ESLint compliance**: Fix linting errors that would block builds

### Testing Requirements
- **For each feature**: Create/update tests before marking complete
- **After changes**: Always run tests to verify everything works
- **Critical - Test error handling**: Every API endpoint MUST have tests that verify:
  1. Valid JSON response returned even on errors
  2. Missing/invalid fields return 400 with JSON error
  3. Server errors return proper JSON (not empty or HTML)
  4. Error messages are clear and actionable
- **Test pattern for API endpoints**:
  - Happy path (valid input → expected output)
  - Missing required fields
  - Invalid data types
  - Edge cases (null, undefined, empty strings)
  - Duplicate data (if applicable)
  - Always verify `Content-Type: application/json`

### Task Management
- **Break down large tasks**: Split into smaller sub-tasks
- **Implement incrementally**: Complete one sub-task before the next
- **Use todo lists**: Track progress using the task management system

### Progress Indication for Multi-Step Features
When implementing features with multi-step processes (bulk upload, AI detection):
- Use `LinearProgress` or `CircularProgress` from Material-UI
- Show percentage completion when deterministic
- Display current step description
- Handle errors gracefully with clear messages
- Disable submit buttons during processing
- Allow cancellation for long-running operations

---

## File Structure Quick Reference

```
frontend/src/
├── pages/           # Route components (AddBook, MyBooks, etc.)
├── components/      # Reusable UI (BookCard, Navbar, etc.)
├── hooks/           # TanStack Query hooks (useBooks, useLoans)
├── contexts/        # React contexts (AuthContext, ThemeContext)
├── lib/             # API client, Supabase client
├── utils/           # Helper functions
├── types.ts         # TypeScript interfaces
└── themes.ts        # MUI theme definitions

api/
├── index.js         # Main Express app (serverless entry)
├── cron/            # Vercel cron jobs
├── services/        # API-specific services
└── __tests__/       # API unit tests (Vitest)

backend_shared_src/
├── controllers/     # Request handlers (books, loans, auth)
├── services/        # Business logic (hybridVision, storage)
├── db/              # Database adapter (Supabase + pg pool)
├── middleware/      # Auth middleware
├── routes/          # Route definitions
└── constants/       # Error codes, config

database/
├── schema.sql       # Full schema reference
└── migrations/      # Numbered migration files

frontend/e2e/        # Playwright E2E tests
```

---

## Database Schema (Key Tables)

```sql
-- Core tables
families (id, name, phone, email, whatsapp)
users (id, family_id, full_name, email, auth_email, is_family_admin)
book_catalog (id, title, author, isbn, genre, cover_image_url)
family_books (id, family_id, catalog_id, status, condition)
loans (id, family_book_id, borrower_family_id, owner_family_id, status)
reviews (id, book_catalog_id, user_id, review_text, rating)
likes (id, book_catalog_id, user_id)

-- Detection system
detection_jobs (id, user_id, status, progress, stage, result, error_code)
```

---

## API Endpoints Summary

### Authentication
- `POST /api/auth/register` - Register new user + family
- `POST /api/auth/login` - Email/password login
- `POST /api/auth/logout` - Clear session

### Books
- `GET /api/books` - List books (filters: familyId, status, search)
- `GET /api/books/:id` - Get book details
- `POST /api/books` - Create book
- `PUT /api/books/:id` - Update book
- `DELETE /api/books/:id` - Delete book

### Loans
- `GET /api/loans` - List loans
- `POST /api/loans` - Create loan
- `PUT /api/loans/:id` - Update loan (return)

### Detection
- `POST /api/books/detect-from-image` - Start AI detection
- `GET /api/detection-jobs/:id` - Get job status
- `POST /api/detection-jobs/:id/retry` - Retry failed job

### Families
- `GET /api/families` - List all families
- `GET /api/families/:id` - Get family details
- `GET /api/families/:id/members` - Get family members
