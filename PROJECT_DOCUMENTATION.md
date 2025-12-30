# CommunityLibrary - Project Documentation

A comprehensive guide to the Community Library application architecture, features, and implementation details.

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture](#architecture)
4. [Database Schema](#database-schema)
5. [Feature Documentation](#feature-documentation)
6. [API Reference](#api-reference)
7. [Frontend Structure](#frontend-structure)
8. [Testing](#testing)

---

## Project Overview

CommunityLibrary is a web application for managing shared book collections among families and communities. It enables users to:

- **Catalog Books**: Add, edit, and organize family book collections
- **Share Books**: Loan books to other families in the community
- **Discover Books**: Search and browse the community catalog
- **AI Detection**: Automatically detect books from shelf photos using AI vision
- **Social Features**: Rate, review, and like books

### Key Design Principles
- **Hebrew-first UI**: All user-facing text in Hebrew, RTL layout
- **Family-based Access**: Users belong to families, books owned by families
- **Shared Catalog**: One book entry, multiple family copies
- **Optimistic Updates**: Instant UI feedback with background sync

---

## Technology Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| React 18 | UI framework |
| TypeScript | Type safety |
| Vite | Build tool & dev server |
| Material-UI (MUI) | Component library |
| TanStack Query | Data fetching & caching |
| React Router | Navigation |

### Backend
| Technology | Purpose |
|------------|---------|
| Express.js | API server |
| Node.js | Runtime |
| Vercel | Serverless hosting |

### Database & Services
| Technology | Purpose |
|------------|---------|
| Supabase | PostgreSQL database |
| Supabase Auth | Authentication |
| Supabase Storage | Image storage |
| Google Gemini | AI book detection |
| Google Cloud Vision | OCR text extraction |

---

## Architecture

### High-Level Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│   API Server    │────▶│    Supabase     │
│  React + Vite   │     │   Express.js    │     │   PostgreSQL    │
│  localhost:5174 │     │  localhost:3001 │     │   Auth/Storage  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │   Google AI     │
                        │  Gemini + OCR   │
                        └─────────────────┘
```

### Directory Structure

```
CommunityLibrary/
├── .github/
│   └── copilot-instructions.md    # AI agent instructions
├── api/                           # Serverless API (Vercel)
│   ├── index.js                   # Main Express app
│   ├── cron/                      # Scheduled jobs
│   ├── services/                  # API-specific services
│   └── __tests__/                 # Unit tests
├── backend/                       # Local dev wrapper
│   └── server.js                  # Imports api/index.js
├── backend_shared_src/            # Shared backend code
│   ├── controllers/               # Request handlers
│   ├── services/                  # Business logic
│   ├── db/                        # Database adapter
│   ├── middleware/                # Auth, validation
│   ├── routes/                    # Route definitions
│   └── constants/                 # Error codes, config
├── database/                      # SQL migrations
│   ├── schema.sql                 # Full schema
│   └── migrations/                # Incremental changes
├── frontend/                      # React application
│   ├── src/
│   │   ├── pages/                 # Route components
│   │   ├── components/            # Reusable UI
│   │   ├── hooks/                 # TanStack Query hooks
│   │   ├── contexts/              # React contexts
│   │   ├── lib/                   # API client
│   │   └── types.ts               # TypeScript types
│   └── e2e/                       # Playwright tests
├── supabase/                      # Edge Functions
│   └── functions/
├── vercel.json                    # Deployment config
└── package.json                   # Root scripts
```

### Code Sharing Pattern

The API code is shared between local development and Vercel deployment:

```
api/index.js  ─────────────────────────────────────▶  Vercel Serverless
      │
      ▼
backend/server.js  ───▶  app.listen(3001)  ───▶  Local Development
```

---

## Database Schema

### Entity Relationship

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  families   │◀──────│    users    │       │ book_catalog│
│             │       │             │       │             │
│ id (PK)     │       │ id (PK)     │       │ id (PK)     │
│ name        │       │ family_id   │──────▶│ title       │
│ phone       │       │ full_name   │       │ author      │
│ email       │       │ email       │       │ isbn        │
└─────────────┘       │ auth_email  │       │ genre       │
       │              └─────────────┘       └─────────────┘
       │                                           │
       ▼                                           ▼
┌─────────────┐                            ┌─────────────┐
│family_books │◀───────────────────────────│             │
│             │                            │             │
│ id (PK)     │                            │   reviews   │
│ family_id   │──────▶ families            │   likes     │
│ catalog_id  │──────▶ book_catalog        │             │
│ status      │                            └─────────────┘
│ condition   │
└─────────────┘
       │
       ▼
┌─────────────┐
│    loans    │
│             │
│ id (PK)     │
│family_book_id│──────▶ family_books
│ borrower_id │──────▶ families
│ owner_id    │──────▶ families
│ status      │
└─────────────┘
```

### Key Tables

#### families
```sql
CREATE TABLE families (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    whatsapp VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### users
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    family_id UUID REFERENCES families(id),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    auth_email VARCHAR(255) UNIQUE NOT NULL, -- Unique for Supabase Auth
    is_family_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### book_catalog
```sql
CREATE TABLE book_catalog (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    author VARCHAR(255),
    isbn VARCHAR(20),
    publisher VARCHAR(255),
    genre VARCHAR(100),
    cover_image_url TEXT,
    series VARCHAR(255),
    series_number INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### family_books
```sql
CREATE TABLE family_books (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID REFERENCES families(id) NOT NULL,
    catalog_id UUID REFERENCES book_catalog(id) NOT NULL,
    status VARCHAR(20) DEFAULT 'available',
    condition VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### loans
```sql
CREATE TABLE loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_book_id UUID REFERENCES family_books(id) NOT NULL,
    borrower_family_id UUID REFERENCES families(id) NOT NULL,
    owner_family_id UUID REFERENCES families(id) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    request_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    return_date TIMESTAMP WITH TIME ZONE,
    notes TEXT
);
```

#### detection_jobs
```sql
CREATE TABLE detection_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    stage VARCHAR(50),
    result JSONB,
    error TEXT,
    error_code VARCHAR(50),
    can_retry BOOLEAN DEFAULT FALSE,
    image_storage_path TEXT,
    thumbnail_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Feature Documentation

### 1. Authentication System

**Implementation**: Supabase Auth + Custom User Table

**Features**:
- Email/Password authentication
- Google OAuth
- Shared email support (multiple users per email via `auth_email`)
- Session management with JWT tokens

**Files**:
- `frontend/src/contexts/AuthContext.tsx` - Auth state management
- `frontend/src/pages/Login.tsx` - Login form
- `frontend/src/pages/Register.tsx` - Registration form
- `backend_shared_src/middleware/auth.js` - JWT verification

**Flow**:
1. User registers → Creates Supabase Auth user + custom user record
2. User logs in → Receives JWT token
3. API calls include JWT in Authorization header
4. Backend verifies token, extracts user ID

### 2. Book Management

**Implementation**: Shared catalog with family copies

**Pattern**:
```
book_catalog (shared metadata)
    │
    └── family_books (individual copies per family)
```

**Features**:
- Add single book manually
- Bulk add via AI detection
- Edit/delete books
- Status tracking (available, on_loan, unavailable)
- Book search and filtering

**Files**:
- `frontend/src/pages/AddBook.tsx` - Book creation form
- `frontend/src/pages/MyBooks.tsx` - Book list view
- `frontend/src/pages/BookDetails.tsx` - Single book view
- `frontend/src/hooks/useBooks.ts` - Data fetching
- `backend_shared_src/controllers/books.controller.js` - API logic

### 3. Loan System

**Implementation**: Optimistic updates with frontend-generated UUIDs

**Features**:
- Create loan (instant UI update)
- Return book
- Loan history
- Automatic status updates

**Key Pattern - Frontend UUID Generation**:
```typescript
// Frontend generates real UUID before API call
const loanId = crypto.randomUUID();

// Optimistic update uses same ID
onMutate: async (newLoan) => {
  // Update cache immediately with loanId
  queryClient.setQueryData(['books'], /* update */);
}

// Server receives same ID - no ID replacement needed
await api.post('/api/loans', { id: loanId, ...data });
```

**Files**:
- `frontend/src/hooks/useLoanMutations.ts` - Loan mutations
- `frontend/src/components/CreateLoanDialog.tsx` - Loan creation UI
- `frontend/src/components/ReturnBookDialog.tsx` - Return UI
- `frontend/src/pages/LoansDashboard.tsx` - Loan management

### 4. AI Book Detection

**Implementation**: Hybrid OCR + AI vision

**Process Flow**:
```
Upload Image
     │
     ▼
Stage 1: Upload (15%)
     │
     ▼
Stage 2: OCR Text Extraction (40%)
     │  └── Google Cloud Vision API
     ▼
Stage 3: AI Book Analysis (70%)
     │  └── Google Gemini
     ▼
Stage 4: Metadata Enrichment (85%)
     │
     ▼
Stage 5: Ownership Check (95%)
     │
     ▼
Stage 6: Complete (100%)
     │
     ▼
Return detected books with metadata
```

**Error Handling**:
| Error Code | Description | Retryable |
|------------|-------------|-----------|
| INVALID_IMAGE | Bad image format | No |
| OCR_FAILED | Text extraction failed | Yes |
| AI_FAILED | Gemini analysis failed | Yes |
| TIMEOUT | Processing too long | Yes |

**Files**:
- `backend_shared_src/services/hybridVision.js` - Detection logic
- `backend_shared_src/services/storageService.js` - Image storage
- `frontend/src/pages/AddBook.tsx` - Upload UI (bulk mode)
- `frontend/src/components/DetectedBooksList.tsx` - Results display

### 5. Theme System

**Implementation**: MUI theming with localStorage persistence

**Available Themes**:
1. Blue (default)
2. Dark
3. Green  
4. Purple
5. Orange

**Files**:
- `frontend/src/themes.ts` - Theme definitions
- `frontend/src/contexts/ThemeContext.tsx` - Theme state
- LocalStorage key: `communityLibrary_theme`

### 6. Social Features

**Reviews**:
- Text review + 1-5 star rating
- One review per user per book
- Edit/delete own reviews

**Likes**:
- Toggle like on books
- Optimistic UI updates
- Like count display

**Files**:
- `frontend/src/components/BookReviews.tsx` - Review list
- `frontend/src/components/AddReviewDialog.tsx` - Review form
- `frontend/src/components/LikeButton.tsx` - Like toggle
- `frontend/src/hooks/useReviews.ts` - Review data

---

## API Reference

### Authentication

```
POST /api/auth/register
Body: { email, password, fullName, phone, familyName }
Response: { user, family, session }

POST /api/auth/login
Body: { email, password }
Response: { user, session }

POST /api/auth/logout
Response: { success: true }

GET /api/auth/user
Headers: Authorization: Bearer <token>
Response: { user }
```

### Books

```
GET /api/books
Query: ?familyId=&status=&search=&genre=
Response: { books: [...] }

GET /api/books/:id
Response: { book }

POST /api/books
Body: { title, author, isbn?, genre?, familyId }
Response: { book }

PUT /api/books/:id
Body: { title?, author?, status?, ... }
Response: { book }

DELETE /api/books/:id
Response: { success: true }
```

### Loans

```
GET /api/loans
Query: ?familyId=&status=&type=(lent|borrowed)
Response: { loans: [...] }

POST /api/loans
Body: { id?, family_book_id, borrower_family_id, owner_family_id }
Response: { loan }

PUT /api/loans/:id
Body: { status?, return_date?, notes? }
Response: { loan }
```

### Detection

```
POST /api/books/detect-from-image
Body: FormData with image file
Response: { jobId, status: 'processing' }

GET /api/detection-jobs/:id
Response: { id, status, progress, stage, result?, error? }

POST /api/detection-jobs/:id/retry
Response: { jobId, status: 'processing' }
```

### Families

```
GET /api/families
Response: { families: [...] }

GET /api/families/:id
Response: { family }

GET /api/families/:id/members
Response: { members: [...] }
```

---

## Frontend Structure

### Pages

| Page | Route | Description |
|------|-------|-------------|
| Home | `/` | Dashboard with stats |
| Login | `/login` | Authentication |
| Register | `/register` | New user registration |
| MyBooks | `/books` | User's book catalog |
| AddBook | `/books/add` | Add new book(s) |
| BookDetails | `/books/:id` | Single book view |
| EditBook | `/books/:id/edit` | Edit book form |
| SearchBooks | `/search` | Community catalog search |
| LoansDashboard | `/loans` | Manage loans |
| FamilyDashboard | `/family` | Family overview |
| Profile | `/profile` | User settings |

### Key Components

| Component | Purpose |
|-----------|---------|
| `Navbar` | Top navigation bar |
| `CatalogBookCard` | Book card with actions |
| `CreateLoanDialog` | Loan creation modal |
| `ReturnBookDialog` | Return book modal |
| `BookReviews` | Review list + add form |
| `LikeButton` | Toggle like with count |
| `QuickStats` | Dashboard statistics |
| `ImageUploadManager` | AI detection upload |

### Data Flow (TanStack Query)

```typescript
// Query keys factory
export const queryKeys = {
  books: {
    all: ['books'],
    list: (filters) => ['books', 'list', filters],
    detail: (id) => ['books', 'detail', id],
  },
  // ...
}

// Query hook
export function useBooks(filters) {
  return useQuery({
    queryKey: queryKeys.books.list(filters),
    queryFn: () => api.get('/api/books', { params: filters }),
    staleTime: 30000,
  })
}

// Mutation with optimistic update
export function useCreateLoan() {
  return useMutation({
    mutationFn: (data) => api.post('/api/loans', data),
    onMutate: async (newLoan) => {
      // Cancel queries, update cache optimistically
    },
    onError: (err, variables, context) => {
      // Rollback on error
    },
  })
}
```

---

## Testing

### API Tests (Vitest)

Location: `api/__tests__/`

```bash
cd api && npm test
```

Test categories:
- `auth.test.js` - Authentication flows
- `books.test.js` - Book CRUD operations
- `loans.test.js` - Loan management
- `families.test.js` - Family operations
- `reviews-likes.test.js` - Social features

### E2E Tests (Playwright)

Location: `frontend/e2e/`

```bash
cd frontend && npm run test:e2e
```

Test files:
- `auth.spec.ts` - Login/register flows
- `books.spec.ts` - Book management
- `delete-book-fix.spec.ts` - Book deletion
- `family.spec.ts` - Family features
- `profile.spec.ts` - Profile management

### Running Tests

```bash
# API tests
cd api && npm test

# E2E tests (requires dev server running)
npm run dev  # In terminal 1
cd frontend && npm run test:e2e  # In terminal 2

# E2E with UI
cd frontend && npm run test:e2e:ui
```

---

## Performance Optimizations

### Database Indexes
- Composite indexes for filtered queries
- Partial indexes for active loans
- Function-based aggregation for likes

### Frontend Caching
- TanStack Query with stale-while-revalidate
- Optimistic updates for instant feedback
- Normalized cache for efficient updates

### API Optimizations
- Connection pooling via Supabase
- Parallel queries with `Promise.all()`
- Embedded data to reduce N+1 queries

---

## Security

### Row Level Security (RLS)
All tables have RLS enabled with policies for:
- Users can view public data
- Users can modify their own data
- Family admins can manage family resources

### Authentication
- JWT tokens with Supabase Auth
- Service role key for admin operations (server only)
- Never expose service role key to frontend

### Storage
- Private buckets with path-based access
- Signed URLs for temporary access
- User isolation via folder structure
