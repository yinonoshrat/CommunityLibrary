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
npm run dev              # Runs frontend (5173) + backend (3001) concurrently
npm run dev:frontend     # Frontend only - proxies /api to localhost:3001
npm run dev:backend      # Backend only (runs api/index.js locally)
```

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
