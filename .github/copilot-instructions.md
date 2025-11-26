# CommunityLibrary - AI Agent Instructions

## Architecture Overview

This project uses a **shared codebase** for local development and Vercel serverless deployment:

- **frontend/**: React + Vite + TypeScript
- **api/**: Express.js app (shared code) - contains all API routes
- **backend/**: Local development server that imports and runs `api/index.js`
- **Root**: Workspace scripts using `concurrently` for local development

### Critical: Shared Code Pattern

**api/index.js** is the single source of truth for API logic:
- Local dev: `backend/server.js` imports and runs it with `app.listen()`
- Vercel: Uses `api/index.js` directly as serverless function (no `app.listen()`)
- `api/package.json` declares dependencies (express, cors) for Vercel

**Why?** This allows identical API code to run both locally and on Vercel without duplication.

## Development Workflow

### Local Development
```bash
npm start                # Alias for npm run dev
npm run dev              # Runs frontend (5174) + backend (3001) concurrently
npm run dev:frontend     # Frontend only - proxies /api to localhost:3001
npm run dev:backend      # Backend only (runs api/index.js locally)
```

### Environment Variables
- **Local development**: Use `.env.development.local` file (pulled from Vercel)
- **Production**: Environment variables managed in Vercel dashboard
- Pull latest env vars: `npx vercel env pull .env.development.local`

### API Testing in Development
- Frontend proxies `/api/*` to `http://localhost:3001` via `vite.config.js`
- Backend runs `api/index.js` with `app.listen()` on port 3001
- Same API code is deployed to Vercel (without `app.listen()`)

### Deployment
- Push to `main` branch → auto-deploys via Vercel Git integration
- Manual: `npx vercel --yes` (preview) or `npx vercel --prod`
- Build: `vercel.json` runs `cd frontend && npm install && npm run build`

## Project-Specific Patterns

### API Routes Pattern
All API routes in `api/index.js` use Express with `/api` prefix:
```javascript
app.get('/api/health', ...)   // Accessed as /api/health
app.get('/api/books', ...)    // Accessed as /api/books
```

### Frontend API Calls
Direct fetch to `/api/*` - Vite proxy handles routing in dev, Vercel rewrites in production:
```typescript
fetch('/api/health')  // Works in both dev and production
```

### Frontend Stack
- React with TypeScript
- `main.ts` renders `<App />` component
- `App.tsx` contains main application logic
- Build: `tsc && vite build` (in `frontend/package.json`)

## Common Tasks

### Adding New API Endpoints
1. Edit `api/index.js` - add Express routes with `/api/` prefix
2. If adding new dependencies, update `api/package.json`
3. Test locally with `npm run dev` (runs both frontend and backend)

### Adding Frontend Features
1. Edit `frontend/src/App.tsx` or create new React components
2. Import components in `App.tsx` or create new routes
3. Run `npm run dev:frontend` to test

### Local Backend Development
The backend folder is now a thin wrapper:
- `backend/server.js` imports `api/index.js` and adds `app.listen()`
- All API logic stays in `api/index.js`
- Never duplicate route logic between `api/` and `backend/`

## Best Practices

- **Single source of truth**: All API routes in `api/index.js`
- **No duplication**: Backend imports api code, never copies it
- **Dependencies**: Update `api/package.json` when adding npm packages for API
- **Testing**: Use `npm run dev` to test full stack locally before deploying

## AI Agent Workflow Guidelines

### Testing Requirements
- **For each feature**: Create tests or update existing tests before marking feature complete
- **After changes**: Always run tests to verify everything works
- **Test locations**: Frontend tests in `frontend/src/__tests__/`, API tests in `api/__tests__/`
- **Critical: Test error handling**: Every API endpoint MUST have tests that verify:
  1. Valid JSON response is returned even on errors
  2. Missing/invalid required fields return 400 with JSON error
  3. Server errors return proper JSON error (not empty response or HTML)
  4. Error messages are clear and actionable
- **Test pattern**: For each API endpoint, create tests for:
  - Happy path (valid input returns expected output)
  - Missing required fields
  - Invalid data types
  - Edge cases (null, undefined, empty strings)
  - Duplicate data (if applicable)
  - Always verify `Content-Type: application/json` header in responses

### Task Management
- **Break down large tasks**: Split big features into smaller, manageable sub-tasks
- **Implement incrementally**: Complete one sub-task at a time before moving to the next
- **Use todo lists**: Track progress using the task management system

### When Uncertain
- **Stop and ask**: If requirements are unclear or multiple approaches are possible, stop and ask for input
- **Don't guess**: Avoid making assumptions about user preferences or business logic
- **Clarify first**: Better to ask for clarification than implement the wrong solution

## Database Integration

### Current Setup: Supabase (Postgres)
- **Database**: Supabase Postgres (connection details in `.env.development.local`)
- **Environment variables** available:
  - `POSTGRES_URL` - Connection string with pooler (recommended for serverless)
  - `POSTGRES_URL_NON_POOLING` - Direct connection (for migrations/admin tasks)
  - `SUPABASE_URL` - Supabase API endpoint
  - `SUPABASE_ANON_KEY` - Public API key for client-side
  - `SUPABASE_SERVICE_ROLE_KEY` - Admin key for server-side operations

### Database Abstraction Pattern
To allow easy database switching in the future:

1. **Create a database adapter layer** (`api/db/adapter.js`):
   ```javascript
   // Example structure - abstracts DB operations
   export const db = {
     query: async (sql, params) => { /* implementation */ },
     books: {
       getAll: async () => { /* implementation */ },
       getById: async (id) => { /* implementation */ },
       create: async (data) => { /* implementation */ }
     }
   }
   ```

2. **Use environment variables for configuration**:
   - Access via `process.env.POSTGRES_URL` or `process.env.SUPABASE_URL`
   - Never hardcode connection strings in code
   
3. **Import the adapter in routes**:
   ```javascript
   import { db } from './db/adapter.js'
   app.get('/api/books', async (req, res) => {
     const books = await db.books.getAll()
     res.json({ books })
   })
   ```

4. **To switch databases**: Update adapter implementation, not route logic
   - Swap Supabase client for PostgreSQL client, MySQL, MongoDB, etc.
   - Routes remain unchanged

### Getting Started with Database
1. Pull environment variables: `npx vercel env pull .env.development.local`
2. Install database client: `cd api && npm install @supabase/supabase-js` (or `pg` for raw Postgres)
3. Create adapter in `api/db/adapter.js`
4. Use adapter in API routes

## UI/UX Implementation Guidelines

### Progress Indication
When implementing features with multi-step processes (like bulk upload with AI), always provide clear progress feedback:

**Example: Bulk Book Upload with AI**
```typescript
// State management
const [progress, setProgress] = useState(0);
const [currentStep, setCurrentStep] = useState('');

// Multi-step process
async function processBooks() {
  setCurrentStep('Detecting books from image...');
  setProgress(25);
  const detected = await aiVisionService.detect(image);
  
  setCurrentStep('Searching online databases...');
  setProgress(50);
  const enriched = await Promise.all(detected.map(searchOnline));
  
  setCurrentStep('Adding books to catalog...');
  setProgress(75);
  await bulkAdd(enriched);
  
  setProgress(100);
  setCurrentStep('Complete!');
}
```

**UI Components for Progress:**
- Use `LinearProgress` or `CircularProgress` from Material-UI
- Show percentage completion when deterministic
- Display current step description
- Provide visual feedback for each phase:
  - Image processing
  - AI detection
  - Online search/enrichment
  - Database insertion
- Handle errors gracefully with clear messages
- Allow cancellation for long-running operations

**Best Practices:**
- Update progress at meaningful milestones, not too frequently
- Show spinner for indeterminate operations
- Disable submit buttons during processing
- Clear error state when retrying
- Celebrate success with clear completion message
