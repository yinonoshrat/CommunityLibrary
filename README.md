# CommunityLibrary

Web app to manage a community library

## Project Structure

```
CommunityLibrary/
├── frontend/          # React + Vite + TypeScript frontend
├── backend/           # Local development server (wraps api/)
├── api/              # Vercel serverless functions (shared code)
├── shared/           # Shared libraries (used by both frontend and backend)
└── vercel.json       # Vercel deployment configuration
```

## Architecture

This project uses a **shared codebase** approach:
- **api/index.js**: Contains the Express app with all routes - used by both local dev and Vercel
- **backend/server.js**: Imports `api/index.js` and runs it locally on port 3001
- **Vercel deployment**: Uses `api/index.js` directly as serverless functions

**Key principle**: API logic lives in `api/`, local development wraps it in `backend/`

## Development

### Prerequisites
- Node.js (v22.1.0 or higher)
- npm

### Installation

Install all dependencies:
```bash
npm run install:all
```

Or install individually:
```bash
npm install                    # Root dependencies
cd frontend && npm install     # Frontend dependencies
cd backend && npm install      # Backend dependencies
```

### Environment Variables

1. Pull environment variables from Vercel:
```bash
npx vercel env pull .env.development.local
```

2. Or copy the example file and fill in your values:
```bash
cp .env.development.local.example .env.development.local
```

Required environment variables:
- `POSTGRES_URL`: Supabase database connection string (with pooler)
- `POSTGRES_URL_NON_POOLING`: Direct database connection (for migrations)
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase public API key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase admin key
- `GEMINI_API_KEY`: Google Gemini API key for AI vision (Phase 7)

**Get Gemini API key**: https://aistudio.google.com/app/apikey

Without `GEMINI_API_KEY`, the bulk book upload with AI vision feature will not work.

### Running Locally

Start both frontend and backend concurrently:
```bash
npm run dev
```

Or run individually:
```bash
npm run dev:frontend   # Frontend only (http://localhost:5173)
npm run dev:backend    # Backend only (http://localhost:3001)
```

### Building for Production

```bash
npm run build
```

## Deployment

This project is configured for deployment on Vercel:

1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in the project root
3. Follow the prompts to deploy

The `vercel.json` configuration handles:
- Building the frontend with Vite
- Routing API requests to `/api/*` to the Express backend (serverless)
- Serving the frontend from `/`

## Tech Stack

- **Frontend**: React, Vite, TypeScript
- **Backend**: Express.js (shared between local and Vercel)
- **Hosting**: Vercel (serverless functions)
- **API Proxy**: Vite dev server proxies `/api` to `http://localhost:3001` in development
