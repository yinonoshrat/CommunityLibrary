# CommunityLibrary

Web app to manage a community library

## Project Structure

```
CommunityLibrary/
├── frontend/          # React + Vite + TypeScript frontend
├── backend/           # Express.js backend
├── api/              # Vercel serverless functions wrapper
└── vercel.json       # Vercel deployment configuration
```

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
- **Backend**: Express.js, Node.js
- **Hosting**: Vercel
- **API Proxy**: Vite dev server proxies `/api` to `http://localhost:3001` in development
