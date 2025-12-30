# Loan/Return Mechanism Design

## Overview
This document describes the optimistic update mechanism for creating and returning book loans. The system provides instant UI feedback while ensuring data consistency without requiring full data refetches.

## Core Principles

### 1. Frontend-Generated UUIDs
- **Frontend generates loan IDs** using `crypto.randomUUID()`
- Same UUID used in optimistic update and server request
- Backend accepts client-provided IDs (Postgres `DEFAULT` allows override)
- **Benefits:**
  - No temp ID issues - real UUID from the start
  - Consistent ID throughout entire flow
  - Idempotent operations (can retry with same ID)
  - No ID replacement logic needed

### 2. Optimistic Updates
- UI updates **immediately** when user clicks loan/return buttons
- Cache is updated **before** server responds
- Server response enriches optimistic data (no ID replacement!)
- Errors trigger automatic rollback to previous state

### 3. No Unnecessary Refetches
- All needed data originates from **frontend state** or **server response**
- Cache updates are **surgical** - only affected books are modified
- Only loan-specific queries are invalidated (not book queries)
- Components re-render only when their data actually changes

### 3. Cache Structure
```typescript
{
  byId: {
    [catalogId]: {
      ...bookData,
      viewerContext: {
        ownedCopies: [{
          familyBookId: "...",
          loan: {
            id: "real-server-uuid",
            borrowerFamily: {...},
            status: "active",
            loanDate: "...",
            dueDate: null
          }
        }]
      },
      stats: {
        availableCopies: 5,
        totalCopies: 10
      }
    }
  }
}
```

## Loan Creation Flow

### 1. User Clicks "השאל ספר"
**Component:** `CatalogBookCard`
```typescript
handleCreateLoan() → onCreateLoan({id, title, author})
```

### 2. Dialog Opens
**Component:** `CreateLoanDialog`
- User selects borrower family
- Clicks "השאל" button
- `createLoan.mutate()` is called

### 3. Optimistic Update (onMutate)
**Hook:** `useCreateLoan` in `useLoanMutations.ts`

**Actions:**
1. **Generate real UUID on frontend** using `crypto.randomUUID()`
2. Cancel any pending book queries to prevent race conditions
3. Take snapshot of current cache for potential rollback
4. Find the target book by `family_book_id` in `ownedCopies`
5. Get borrower family name from families cache
6. Create optimistic loan object with **real UUID** (same ID that will be sent to server):
   ```typescript
   {
     id: crypto.randomUUID(),  // Real UUID, not temp!
     borrowerFamily: { id, name },
     status: 'active',
     loanDate: new Date().toISOString(),
     dueDate: null
   }
   ```
7. Create updated book object:
   - Add loan to `ownedCopies[].loan`
   - Decrement `stats.availableCopies` by 1
8. Update normalized cache with new book object
9. Update all matching list queries with new book object

**Result:** Button changes from "השאל ספר" to "סמן כהוחזר" **instantly**

### 4. Server Request
**API Call:** `POST /api/loans`
```json
{
  "id": "real-uuid-from-frontend",  // ← Frontend-generated!
  "family_book_id": "uuid",
  "borrower_family_id": "uuid",
  "owner_family_id": "uuid",
  "requester_user_id": "uuid"
}
```

**Backend:** Uses the provided UUID instead of generating one

### 5. Server Response Processing (onSuccess)
**Server Returns:**
```json
{
  "loan": {
    "id": "same-uuid-from-frontend",  // ← Same ID we sent!
    "family_book_id": "...",
    "borrower_family_id": "...",
    "owner_family_id": "...",
    "borrower_family": { "id": "...", "name": "..." },
    "owner_family": { "id": "...", "name": "..." },
    "status": "active",
    "loan_date": "2025-12-04T...",
    "due_date": null,
    "created_at": "2025-12-04T..."
  }
}
```

**Actions:**
1. Validate server response has `loan.id`
2. Verify server used our UUID (log warning if different)
3. Find the book in cache (using context from onMutate)
4. **Enrich** optimistic loan with server data (ID is already correct!):
   ```typescript
   loan: {
     ...existingLoan,  // Keep ID and basic data
     borrowerFamily: serverLoan.borrower_family,  // Add server-provided details
     ownerFamily: serverLoan.owner_family,
     loanDate: serverLoan.loan_date || existingLoan.loanDate,
     dueDate: serverLoan.due_date
   }
   ```
5. Update normalized cache with enriched data
6. Update all list queries with enriched data
7. Invalidate loan queries (NOT book queries - we already have the right data)

**Result:** Loan is fully populated with server data, button stays showing "סמן כהוחזר"

**Key Difference:** No ID replacement needed - we use the same UUID throughout!

### 6. Error Handling (onError)
**Actions:**
1. Restore cache from snapshot taken in onMutate
2. Update all list queries to reflect rollback
3. User sees original state (button back to "השאל ספר")
4. Error message displayed in dialog

## Return Flow

### 1. User Clicks "סמן כהוחזר"
**Component:** `CatalogBookCard`
```typescript
handleMarkReturned() → onMarkReturned({book, loan})
```

**Critical:** `loan.id` is the **real server UUID** (not temp ID)

### 2. Dialog Opens
**Component:** `ReturnBookDialog`
- Shows loan details
- User confirms return date
- `updateLoan.mutate()` is called with loan.id

### 3. Optimistic Update (onMutate)
**Hook:** `useUpdateLoan` in `useLoanMutations.ts`

**Actions:**
1. Cancel any pending book queries
2. Take snapshot of current cache for potential rollback
3. Find the target book by `familyBookId` in `ownedCopies`
4. Create updated book object:
   - Remove loan from `ownedCopies[].loan` (set to null)
   - Increment `stats.availableCopies` by 1
5. Update normalized cache with new book object
6. Update all matching list queries with new book object

**Result:** Button changes from "סמן כהוחזר" to "השאל ספר" **instantly**

### 4. Server Request
**API Call:** `PUT /api/loans/{real-uuid}`
```json
{
  "status": "returned",
  "return_date": "2025-12-04"
}
```

### 5. Server Response Processing (onSuccess)
**Actions:**
1. Server confirms return (loan status updated to 'returned')
2. Cache already shows correct state (loan removed, book available)
3. Invalidate loan queries only (NOT book queries)

**Result:** Button stays showing "השאל ספר"

### 6. Error Handling (onError)
**Actions:**
1. Restore cache from snapshot
2. Update all list queries to reflect rollback
3. User sees loan restored (button back to "סמן כהוחזר")
4. Error message displayed in dialog

## Key Benefits

### ✅ Instant UI Feedback
- Buttons change state immediately on click
- No waiting for server response
- Feels like a native app

### ✅ No Full Refetches
- Only affected book objects are updated
- No need to refetch entire book list
- Minimal network traffic

### ✅ Automatic Rollback
- Any server error automatically reverts UI
- No manual error handling needed
- User sees accurate state

### ✅ Surgical Cache Updates
- Only modified books trigger re-renders
- Other books remain stable
- React.memo prevents unnecessary renders

### ✅ Consistent State
- Server response always overwrites optimistic data
- Real loan IDs replace temporary IDs
- Cache always matches server truth

## React Query Configuration

### Cache Keys
```typescript
// Normalized cache (single source of truth)
['books', 'normalized'] → { byId: {...}, queriesData: {...} }

// List queries (views into normalized cache)
['books', 'list', {filters}] → { books: [...] }

// Loan queries
['loans', 'all']
['loans', 'by-book', familyBookId]
['loans', 'by-owner', ownerId]
['loans', 'by-borrower', borrowerId]
```

### Mutation Options
```typescript
{
  onMutate: async (variables) => {
    // 1. Cancel ongoing fetches
    // 2. Snapshot cache
    // 3. Apply optimistic update
    // 4. Return context for onError/onSuccess
  },
  onError: (error, variables, context) => {
    // 1. Restore from snapshot
    // 2. Update all affected queries
  },
  onSuccess: (data, variables, context) => {
    // 1. Replace optimistic data with server data
    // 2. Update cache surgically
    // 3. Invalidate related queries (NOT main book queries)
  }
}
```

## Testing Checklist

### Create Loan
- [ ] Button changes immediately to "סמן כהוחזר"
- [ ] Available copies decrements by 1
- [ ] Borrower family name displays correctly
- [ ] After server responds, button stays "סמן כהוחזר"
- [ ] Real loan ID is in cache (inspect with React Query DevTools)
- [ ] On error, button reverts to "השאל ספר"

### Return Loan
- [ ] Button changes immediately to "השאל ספר"
- [ ] Available copies increments by 1
- [ ] After server responds, button stays "השאל ספר"
- [ ] On error, button reverts to "סמן כהוחזר"

### Navigation
- [ ] Leave page and come back - state persists correctly
- [ ] Navigate to book details - loan state matches list
- [ ] Multiple books on page - only affected book re-renders

## Common Issues & Solutions

### Issue: Button reverts after clicking
**Cause:** Server response triggering unwanted refetch
**Solution:** Only invalidate loan queries, NOT book queries

### Issue: Loan ID is temporary when trying to return
**Cause:** Optimistic data not replaced by server data
**Solution:** Check onSuccess properly updates cache with real loan.id

### Issue: Other books flash/re-render
**Cause:** Full cache invalidation or creating new book objects
**Solution:** Only update affected book, reuse other book objects

### Issue: State inconsistent across pages
**Cause:** Multiple cache sources, not using normalized cache
**Solution:** All data flows through normalized cache

## Files Modified

### Core Hooks
- `frontend/src/hooks/useLoanMutations.ts` - Loan mutation logic with optimistic updates

### Components
- `frontend/src/components/CatalogBookCard.tsx` - Displays loan/return buttons
- `frontend/src/components/CreateLoanDialog.tsx` - Loan creation UI
- `frontend/src/components/ReturnBookDialog.tsx` - Return confirmation UI

### Pages
- `frontend/src/pages/MyBooks.tsx` - Main books list with loan handlers

### Backend
- `backend_shared_src/controllers/loans.controller.js` - Loan API endpoints
- `backend_shared_src/db/adapter.js` - Database operations
