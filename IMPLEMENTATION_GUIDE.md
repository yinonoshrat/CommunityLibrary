# מדריך יישום – אפליקציית ספרייה קהילתית
# Community Library - Implementation Guide

## סקירה כללית / Overview

מסמך זה מפרט את תהליך הבנייה השלבי של אפליקציית הספרייה הקהילתית.
כל שלב בנוי על הקודם ומוסיף פונקציונליות חדשה.

This document details the phased implementation of the Community Library application.
Each phase builds on the previous one and adds new functionality.

---

## 🎨 Design Guidelines / הנחיות עיצוב

**IMPORTANT:** All pages must follow these consistent design patterns:

### Layout Standards:
- **Container:** Use `<Container maxWidth="lg">` for all main content areas
- **Spacing:** Consistent margins - `sx={{ mt: 4, mb: 4 }}` for top-level containers
- **Typography:** Follow Material-UI hierarchy (h4 for page titles, h6 for sections, body1/body2 for content)
- **RTL Support:** All components must work correctly with Hebrew text direction

### Component Structure:
```tsx
<Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
  <Box mb={4}>
    <Typography variant="h4" component="h1" gutterBottom>
      עنوان הדף
    </Typography>
    <Typography variant="body1" color="text.secondary">
      תיאור קצר
    </Typography>
  </Box>
  
  {/* Main content */}
</Container>
```

### Theme Consistency:
- **Colors:** Use theme colors (`primary.main`, `secondary.main`, `error`, `warning`, `info`, `success`)
- **Cards:** Standard elevation and padding - `<Card><CardContent>...</CardContent></Card>`
- **Buttons:** Consistent sizing - `sx={{ py: 1.5 }}` for full-width action buttons
- **Spacing:** Use theme spacing units (multiples of 8px)
- **Grid Layout:** Use Material-UI `Grid` with `size` prop for responsive layouts
- **Grid Sizing:** When creating rows of equal-width cards, ALL Grid items in that row MUST use identical size props (e.g., `size={{ xs: 12, sm: 4 }}` for 3-column layout)

### Hebrew UI Patterns:
- All text in Hebrew (except code/technical terms)
- Icons on the RIGHT side of text (RTL)
- Navigation flows right-to-left
- Forms: labels above inputs, aligned right
- Action buttons: primary action on RIGHT, cancel on LEFT

### Reusable Components:
Before creating new components, check if these exist:
- `QuickStats.tsx` - Statistics cards with icons
- `QuickActions.tsx` - Action button grid
- `RecentActivity.tsx` - Activity feed list
- Create new reusable components in `frontend/src/components/`

---

## ✅ Phase 0: Infrastructure (COMPLETED)

**Status:** ✅ Complete

### What was built:
- [x] React + Vite + TypeScript frontend
- [x] Express.js backend API
- [x] Supabase PostgreSQL database
- [x] Hebrew RTL UI with Material-UI
- [x] Authentication system with shared email support
- [x] Database schema with RLS policies
- [x] Testing infrastructure (Vitest + Supertest)

### Database Tables:
- ✅ families
- ✅ users (with auth_email for shared emails)
- ✅ books
- ✅ loans
- ✅ reviews
- ✅ likes

### Current Issue:
- ⚠️ **RLS INSERT policy missing for users table** - blocking registration of additional family members
- **Fix Required:** Run SQL in Supabase dashboard (see database/migrations/003_add_users_insert_policy.sql)

---

## 🔄 Phase 1: Complete Authentication Module (IN PROGRESS)

**Priority:** HIGH - Foundation for all features
**Estimated Time:** 2-3 hours

### 1.1 Fix RLS Policy ⚠️ URGENT
**Files to modify:** Supabase Dashboard (SQL Editor)

```sql
CREATE POLICY "Anyone can create user during registration" ON users 
FOR INSERT 
WITH CHECK (true);
```

**Testing:**
- [ ] Register first user with new family
- [ ] Register second user to same family
- [ ] Verify both can login
- [ ] Check users table in database

---

### 1.2 Build Profile Page
**Files to create:**
- `frontend/src/pages/Profile.tsx`
- `frontend/src/components/ProfileForm.tsx`

**Features:**
- View/edit personal details (name, phone, email)
- View family information
- Change password option
- Logout button
- Profile image upload (future)

**API Endpoints (already exist):**
- `GET /api/users/:id` - Get user profile
- `PUT /api/users/:id` - Update profile
- `GET /api/families/:id` - Get family details

**Design:**
```
┌─────────────────────────────┐
│  [← Back]        [הפרופיל שלי] │
├─────────────────────────────┤
│  👤 [Profile Image]          │
│                              │
│  שם מלא: [____]              │
│  טלפון: [____]               │
│  אימייל: [____]              │
│  משפחה: [משפחה כהן]          │
│  מנהל משפחה: כן / לא         │
│                              │
│  [שמור שינויים]               │
│  [שנה סיסמה]                 │
│  [התנתק]                     │
└─────────────────────────────┘
```

**Testing:**
- [ ] View profile displays correct data
- [ ] Edit name, phone updates successfully
- [ ] Email cannot be changed (display only)
- [ ] Logout clears session and redirects to login

---

### 1.3 Protected Routes & Navigation
**Files to modify:**
- `frontend/src/App.tsx`
- Create: `frontend/src/components/Layout.tsx`
- Create: `frontend/src/components/AppBar.tsx`

**Features:**
- Check authentication on route access
- Redirect to login if not authenticated
- Top navigation bar with:
  - Logo/Title
  - Navigation menu
  - Profile icon/name
  - Logout option
- Mobile-responsive drawer menu

**Navigation Structure:**
```
- בית (Home)
- הספרים שלי (My Books)
- חיפוש ספרים (Search Books)
- השאלות (Loans)
- המשפחה שלי (My Family)
- הפרופיל שלי (Profile)
```

**Testing:**
- [ ] Unauthenticated users redirected to login
- [ ] Navigation shows all menu items
- [ ] Active route highlighted
- [ ] Mobile menu works on small screens

---

## 📚 Phase 2: Family Management Module

**Priority:** HIGH
**Estimated Time:** 3-4 hours
**Dependencies:** Phase 1 complete

### 2.1 Family Dashboard
**Files to create:**
- `frontend/src/pages/FamilyDashboard.tsx`
- `frontend/src/components/FamilyStats.tsx`

**Features:**
- Display family name, phone, WhatsApp
- Show family statistics:
  - Total books in catalog
  - Books currently on loan (lent out)
  - Books borrowed from others
  - Active family members
- Quick actions:
  - Add book
  - View loans
  - Manage members (admin only)

**API Endpoints (already exist):**
- `GET /api/families/:id`
- `GET /api/books?familyId=:id`
- `GET /api/loans?familyId=:id`

**Design:**
```
┌──────────────────────────────┐
│     דף הבית - משפחת כהן       │
├──────────────────────────────┤
│  📚 ספרים בקטלוג: 47          │
│  📤 ספרים מושאלים: 3          │
│  📥 ספרים שהשאלנו: 2          │
│  👥 חברי משפחה: 4             │
├──────────────────────────────┤
│  [➕ הוסף ספר]                │
│  [📋 הצג כל הספרים]           │
│  [🔄 ניהול השאלות]            │
│  [👨‍👩‍👧‍👦 ניהול חברי משפחה]  │
└──────────────────────────────┘
```

**Testing:**
- [ ] Dashboard shows correct statistics
- [ ] Admin sees management options
- [ ] Non-admin doesn't see admin buttons
- [ ] Quick actions navigate correctly

---

### 2.2 Family Members Management (Admin Only)
**Files to create:**
- `frontend/src/pages/FamilyMembers.tsx`
- `frontend/src/components/MemberCard.tsx`
- `frontend/src/components/AddMemberDialog.tsx`

**Features:**
- List all family members
- Show member details (name, phone, email, admin status)
- Add new member (sends invitation)
- Edit member details (admin only)
- Remove member (admin only, cannot remove self)
- Promote/demote admin status

**API Endpoints (already exist):**
- `GET /api/users?familyId=:id`
- `PUT /api/users/:id` - Update member
- `DELETE /api/users/:id` - Remove member

**Design:**
```
┌──────────────────────────────┐
│  [← חזרה]     חברי המשפחה     │
├──────────────────────────────┤
│  👤 דוד כהן                   │
│     050-1234567              │
│     david@example.com        │
│     🔑 מנהל משפחה            │
│     [ערוך] [הסר]             │
├──────────────────────────────┤
│  👤 שרה כהן                   │
│     050-7654321              │
│     sara@example.com         │
│     [ערוך] [הסר]             │
├──────────────────────────────┤
│  [➕ הוסף חבר משפחה]          │
└──────────────────────────────┘
```

**Testing:**
- [ ] Only family admin can access
- [ ] List shows all family members
- [ ] Add member form validation works
- [ ] Cannot remove self
- [ ] Edit updates successfully

---

## 📖 Phase 3: Books Management Module

**Priority:** HIGH
**Estimated Time:** 6-8 hours
**Dependencies:** Phase 2 complete
**Status:** ✅ Complete

### 3.1 Family Book Catalog ✅
**Files created:**
- `frontend/src/pages/MyBooks.tsx` ✅
- `frontend/src/components/BookCard.tsx` ✅

**Features:**
- Display all family books in grid/list view
- Filter by:
  - Status (available, on loan, borrowed)
  - Genre
  - Age level
- Sort by: title, author, date added
- Search within family books
- Click book to view details

**API Endpoints (already exist):**
- `GET /api/books?familyId=:id`
- `GET /api/genres`
- `GET /api/age-levels`

**Design:**
```
┌────────────────────────────────┐
│  [← חזרה]    הספרים שלי         │
│  [חפש: ____]  [➕ הוסף ספר]    │
├────────────────────────────────┤
│  סינון: [הכל ▼] [ז'אנר ▼]     │
├────────────────────────────────┤
│  ┌─────┐  ┌─────┐  ┌─────┐   │
│  │ 📕  │  │ 📗  │  │ 📘  │   │
│  │ שם  │  │ שם  │  │ שם  │   │
│  │הספר │  │הספר │  │הספר │   │
│  │מחבר │  │מחבר │  │מחבר │   │
│  │זמין │  │מושאל│  │זמין │   │
│  └─────┘  └─────┘  └─────┘   │
└────────────────────────────────┘
```

**Testing:**
- [x] Books display correctly
- [x] Filters work
- [x] Search returns relevant results
- [x] Book status displayed correctly

---

### 3.2 Add Book Manually ✅
**Files created:**
- `frontend/src/pages/AddBook.tsx` ✅

**Features:**
- Manual form with fields:
  - Title (Hebrew/English)
  - Author
  - ISBN (optional)
  - Year published
  - Publisher
  - Genre (dropdown)
  - Age level (dropdown)
  - Pages/Size
  - Summary (textarea)
  - Cover image (upload/URL)
- Option to search online first (Google Books API)
- Auto-fill from search results
- Manual override for any field
- Preview before saving

**API Endpoints:**
- `POST /api/books` (already exists)
- `GET /api/books/search?q=:query` (need to implement)
  - Integrates with Google Books API
  - Returns book suggestions

**New API Implementation Needed:**
```javascript
// In api/index.js
app.get('/api/books/search', async (req, res) => {
  const { q } = req.query;
  // Call Google Books API
  // Return formatted results
});
```

**Design:**
```
┌──────────────────────────────┐
│  [← חזרה]     הוסף ספר חדש    │
├──────────────────────────────┤
│  חפש מקוון: [____] [🔍]      │
│                              │
│  שם הספר: [____] *           │
│  מחבר: [____] *              │
│  ISBN: [____]                │
│  שנה: [____]                 │
│  הוצאה לאור: [____]          │
│  ז'אנר: [בחר ▼] *            │
│  גיל: [בחר ▼]                │
│  עמודים: [____]              │
│  תקציר: [________]           │
│           [________]          │
│  תמונה: [📤 העלה]            │
│                              │
│  [שמור]  [ביטול]             │
└──────────────────────────────┘
```

**Testing:**
- [x] Form validation works
- [ ] Online search returns results (not implemented yet - Phase 4)
- [ ] Can select from search results (not implemented yet - Phase 4)
- [x] Manual entry works
- [x] Book saved successfully
- [ ] Image upload works (URL input only)

---

### 3.3 Book Details Page ✅
**Files created:**
- `frontend/src/pages/BookDetails.tsx` ✅

**Features:**
- Display full book information
- Show cover image
- Display loan status:
  - Available
  - On loan to: [family name], due: [date]
  - Borrowed from: [family name], due: [date]
- Show reviews and ratings (read-only for now)
- Actions:
  - Edit book (owner family only)
  - Delete book (owner family only)
  - Mark as on loan / return
- Share book details (copy link)

**API Endpoints (already exist):**
- `GET /api/books/:id`
- `PUT /api/books/:id`
- `DELETE /api/books/:id`
- `GET /api/reviews?bookId=:id`
- `GET /api/loans?bookId=:id`

**Design:**
```
┌──────────────────────────────┐
│  [← חזרה]                     │
├──────────────────────────────┤
│   ┌───────┐                  │
│   │       │  הארי פוטר        │
│   │ 📕   │  ג'יי.קיי רולינג   │
│   │       │                  │
│   └───────┘  ⭐⭐⭐⭐⭐ (23)    │
│                              │
│  ז'אנר: פנטזיה               │
│  גיל: 10+                    │
│  שנה: 1998                   │
│  הוצאה: כתר                  │
│                              │
│  סטטוס: 🟢 זמין              │
│                              │
│  תקציר: ספר הרפתקאות...      │
│                              │
│  [✏️ ערוך]  [🗑️ מחק]         │
└──────────────────────────────┘
```

**Testing:**
- [x] Book details display correctly
- [x] Only owner can edit/delete
- [x] Status shows correctly
- [ ] Reviews display (Phase 6)
- [x] Navigation works

---

### 3.4 Edit Book ✅
**Files created:**
- `frontend/src/pages/EditBook.tsx` ✅

**Features implemented:**
- Same form as Add Book ✅
- Pre-filled with existing data ✅
- Cannot change book ID ✅
- Can update all other fields ✅
- Confirmation before saving ✅

**API Endpoints (already exist):**
- `GET /api/books/:id`
- `PUT /api/books/:id`

**Testing:**
- [x] Form pre-fills correctly
- [x] Updates save successfully
- [x] Validation works
- [x] Redirects after save

---

## 🔍 Phase 4: Community Search Module

**Priority:** MEDIUM
**Estimated Time:** 4-5 hours
**Dependencies:** Phase 3 complete

### 4.1 Community-Wide Book Search
**Files to create:**
- `frontend/src/pages/SearchBooks.tsx`
- `frontend/src/components/CommunityBookCard.tsx`
- `frontend/src/components/AvailabilityBadge.tsx`

**Features:**
- Search across ALL books in the community
- Search by:
  - Title
  - Author
  - Series
  - Genre
  - Age level
  - Free text
- Show which families have each book
- Show availability status per family
- Click to view book details
- Click family to contact (WhatsApp/Phone)

**API Endpoints:**
- `GET /api/books/search?q=:query` (need to enhance)
  - Search across all books
  - Include family information
  - Include availability

**Enhanced API Implementation:**
```javascript
// In api/index.js
app.get('/api/books/search', async (req, res) => {
  const { q, genre, ageLevel, available } = req.query;
  // Search books with filters
  // Join with families table
  // Include loan status
  // Return with family details
});
```

**Design:**
```
┌──────────────────────────────┐
│  חיפוש ספרים בקהילה           │
│  [חפש: ____]  [🔍]            │
│                              │
│  מסננים:                     │
│  ז'אנר: [הכל ▼]              │
│  גיל: [הכל ▼]                │
│  □ רק זמינים                 │
├──────────────────────────────┤
│  📕 הארי פוטר                │
│     ג'יי.קיי רולינג           │
│     ⭐⭐⭐⭐⭐ (23)              │
│                              │
│     🟢 זמין אצל:             │
│     • משפחת כהן [💬]         │
│     • משפחת לוי [💬]          │
│     🔴 מושאל אצל:            │
│     • משפחת אברהם            │
│                              │
│  [הצג פרטים]                 │
├──────────────────────────────┤
│  📗 הרי פוטר 2...            │
└──────────────────────────────┘
```

**Testing:**
- [ ] Search returns results from all families
- [ ] Filters work correctly
- [ ] Shows which families have the book
- [ ] Contact buttons work (WhatsApp)
- [ ] "Only available" filter works

---

### 4.2 Book Details (Community View)
**Files to modify:**
- `frontend/src/pages/BookDetails.tsx` (enhance for community view)

**Features:**
- Same as family book details, but:
  - Show all families that have this book
  - Show availability for each family
  - Option to request loan from available families
  - Cannot edit/delete (not owner)
  - Can add review (Phase 5)

**New Components:**
- `frontend/src/components/FamilyAvailability.tsx`
- `frontend/src/components/LoanRequestButton.tsx`

**API Endpoints (already exist):**
- `GET /api/books/:id/families` (need to implement)
  - Returns all families with this book
  - Includes availability status

**New API Implementation:**
```javascript
// In api/index.js
app.get('/api/books/:id/families', async (req, res) => {
  // Get all families that have this book
  // Include loan status
  // Return with family contact info
});
```

**Testing:**
- [ ] Shows all families with book
- [ ] Availability correct for each
- [ ] Cannot edit other family's books
- [ ] Request button shows for available only

---

## 🔄 Phase 5: Loans Management Module

**Priority:** HIGH
**Estimated Time:** 4-5 hours
**Dependencies:** Phase 3 complete
**Note:** Simplified workflow - owner family manages loans directly without approval flow

### 5.1 Create Loan (Owner Marks Book as Loaned)
**Files to create:**
- `frontend/src/components/CreateLoanDialog.tsx`

**Features:**
- Owner marks book as loaned out from book details page
- Select borrower family from dropdown (all families in community)
- Add optional notes
- Book status automatically updates to "on loan"

**API Endpoints:**
- `POST /api/loans` (already exists, may need enhancement)

**Enhanced API Implementation:**
```javascript
// In api/index.js
app.post('/api/loans', async (req, res) => {
  const { bookId, borrowerFamilyId, notes } = req.body;
  // Verify requester is book owner
  // Create loan with status 'active'
  // Update book status to 'on_loan'
  // Return loan details
});
```

**Design:**
```
┌──────────────────────────────┐
│  השאל ספר                    │
├──────────────────────────────┤
│  ספר: הארי פוטר               │
│                              │
│  משפחה שואלת:                │
│  [בחר משפחה ▼]               │
│                              │
│  הערות (אופציונלי):          │
│  [_____________]             │
│                              │
│  [השאל]  [ביטול]             │
└──────────────────────────────┘
```

**Testing:**
- [ ] Only book owner can create loan
- [ ] Loan created with 'active' status
- [ ] Book status updates to 'on_loan'
- [ ] Borrower family dropdown shows all families
- [ ] Cannot loan already loaned book

---

### 5.2 Loans Dashboard
**Files to create:**
- `frontend/src/pages/LoansDashboard.tsx`
- `frontend/src/components/LoanCard.tsx`

**Features:**
- View all loans in one place
- Tabs for:
  - **ספרים שהשאלנו** (Books we lent out) - active loans we created
  - **ספרים ששאלנו** (Books we borrowed) - books others loaned to us
  - **היסטוריה** (History) - completed/returned loans
- For each loan:
  - Book details with cover image
  - Other family name & contact (WhatsApp)
  - Loan date
  - Notes
  - Action button: "סמן כהוחזר" (Mark as returned) for lent books

**API Endpoints (already exist):**
- `GET /api/loans?ownerFamilyId=:id&status=active` - Books we lent
- `GET /api/loans?borrowerFamilyId=:id&status=active` - Books we borrowed
- `GET /api/loans?ownerFamilyId=:id&status=returned` - Our loan history
- `GET /api/loans?borrowerFamilyId=:id&status=returned` - Books we returned

**Design:**
```
┌──────────────────────────────┐
│  ניהול השאלות                 │
├──────────────────────────────┤
│  [השאלנו] [שאלנו] [היסטוריה] │
├──────────────────────────────┤
│  📕 הארי פוטר                │
│     ל: משפחת לוי [💬]         │
│     📝 הערות: ...             │
│     [✓ סמן כהוחזר]           │
├──────────────────────────────┤
│  📗 הוביט                    │
│     ל: משפחת אברהם [💬]       │
│     [✓ סמן כהוחזר]           │
└──────────────────────────────┘
```

**Testing:**
- [ ] Tabs show correct loans
- [ ] Lent books tab shows books we loaned out
- [ ] Borrowed books tab shows books we borrowed
- [ ] History shows completed loans
- [ ] Contact buttons work (WhatsApp)
- [ ] Return button only on lent books tab

---

### 5.3 Return Book (Mark as Returned)
**Files to create:**
- `frontend/src/components/ReturnBookDialog.tsx`

**Features:**
- Owner marks loaned book as returned
- Confirm return date (defaults to today)
- Optional notes about return condition
- Update book status to available
- Move loan to history (status: 'returned')
- Simple confirmation dialog

**API Endpoints:**
- `PUT /api/loans/:id/return` (need to implement)

**New API Implementation:**
```javascript
// In api/index.js
app.put('/api/loans/:id/return', async (req, res) => {
  const { actualReturnDate, notes } = req.body;
  // Verify requester is loan owner
  // Update loan status to 'returned'
  // Set actual_return_date (default: today)
  // Update book status to 'available'
  // Return updated loan
});
```

**Design:**
```
┌──────────────────────────────┐
│  סמן כהוחזר                  │
├──────────────────────────────┤
│  ספר: הארי פוטר               │
│  שאל: משפחת לוי               │
│                              │
│  תאריך החזרה:                │
│  [📅 25/11/2025] (היום)      │
│                              │
│  הערות (אופציונלי):          │
│  [_____________]             │
│                              │
│  [אשר החזרה]  [ביטול]        │
└──────────────────────────────┘
```

**Testing:**
- [ ] Only loan owner can mark as returned
- [ ] Return date defaults to today
- [ ] Book status updates to 'available'
- [ ] Loan moves to history tab
- [ ] Cannot return same loan twice

---

## ⭐ Phase 6: Reviews and Recommendations Module

**Priority:** MEDIUM
**Estimated Time:** 4-5 hours
**Dependencies:** Phase 5 complete
**Status:** ✅ Complete (Implementation + E2E Tests)

### 6.1 Add Book Review ✅
**Files created:**
- `frontend/src/components/AddReviewDialog.tsx` ✅
- `frontend/src/components/ReviewForm.tsx` ✅

**Features:**
- Rate book (1-5 stars) ✅
- Write review text ✅
- Add to any book in community ✅
- Cannot review same book twice ✅
- Can edit own review ✅
- Display reviewer name ✅

**API Endpoints (already exist):**
- `POST /api/reviews` ✅
- `PUT /api/reviews/:id` ✅
- `DELETE /api/reviews/:id` ✅

**Design:**
```
┌──────────────────────────────┐
│  הוסף ביקורת                 │
├──────────────────────────────┤
│  ספר: הארי פוטר               │
│                              │
│  דירוג:                      │
│  ⭐⭐⭐⭐⭐                      │
│                              │
│  הביקורת שלך:                │
│  [___________________]       │
│  [___________________]       │
│  [___________________]       │
│                              │
│  [שמור]  [ביטול]             │
└──────────────────────────────┘
```

**Testing:**
- [x] Review saves successfully
- [x] Rating displays correctly
- [x] Cannot review same book twice
- [x] Can edit own review
- [x] Cannot edit others' reviews
- [x] E2E tests (18 tests covering all scenarios)

---

### 6.2 Display Reviews on Book Page ✅
**Files created:**
- `frontend/src/components/BookReviews.tsx` ✅

**Features:**
- Show all reviews for book ✅
- Display average rating ✅
- Show reviewer name and date ✅
- Sort by: newest, highest rated, lowest rated ✅
- "Add review" button ✅
- Edit/delete own review ✅

**API Endpoints (already exist):**
- `GET /api/reviews?bookId=:id` ✅

**Design:**
```
┌──────────────────────────────┐
│  ביקורות                     │
│  ⭐⭐⭐⭐⭐ 4.5 (23 ביקורות)   │
│  [הוסף ביקורת]               │
├──────────────────────────────┤
│  👤 דוד כהן                  │
│  ⭐⭐⭐⭐⭐                      │
│  לפני 2 ימים                 │
│  ספר מדהים! ממליץ בחום...    │
│  [עריכה] [מחיקה]             │
├──────────────────────────────┤
│  👤 שרה לוי                  │
│  ⭐⭐⭐⭐                        │
│  לפני שבוע                   │
│  ספר טוב אבל קצת ארוך...     │
└──────────────────────────────┘
```

**Testing:**
- [x] Reviews display correctly
- [x] Average rating calculated
- [x] Sort options work
- [x] Can only edit/delete own
- [x] Add review opens dialog
- [x] E2E tests cover all functionality

---

### 6.3 Like/Unlike Books ✅
**Files created:**
- `frontend/src/components/LikeButton.tsx` ✅

**Features:**
- Heart icon on book cards and details page ✅
- Click to like/unlike ✅
- Show like count ✅
- Used for recommendations algorithm ✅

**API Endpoints (already exist):**
- `POST /api/likes` ✅
- `DELETE /api/likes/:id` ✅
- `GET /api/likes?userId=:id` ✅

**Testing:**
- [x] Like adds record
- [x] Unlike removes record
- [x] Count updates immediately
- [x] Cannot like twice
- [x] Visual feedback on toggle
- [x] E2E tests (15 tests covering all scenarios)

---

### 6.4 Recommendations Engine ✅
**Files created:**
- `frontend/src/pages/Recommendations.tsx` ✅
- Integrated with `BookCard.tsx` component ✅

**Features:**
- Algorithm based on: ✅
  - Books user liked
  - Books user reviewed (4+ stars)
  - Books user borrowed
  - Preferred genres
  - Age level matches
- Show "match percentage" or confidence score ✅
- Explain why recommended ("based on your love of fantasy") ✅
- Filter by availability ✅
- Click to view book details ✅

**API Endpoints:**
- `GET /api/recommendations?userId=:id` ✅ (implemented)

**New API Implementation:**
```javascript
// In api/index.js
app.get('/api/recommendations', async (req, res) => {
  const { userId } = req.query;
  
  // 1. Get user's liked books
  // 2. Get user's high-rated reviews
  // 3. Get user's borrowed books
  // 4. Extract common genres and age levels
  // 5. Find similar books NOT owned/read by user
  // 6. Score by multiple factors
  // 7. Return top recommendations
});
```

**Algorithm Example:**
```javascript
function calculateRecommendationScore(book, userProfile) {
  let score = 0;
  
  // Genre match (0-30 points)
  if (userProfile.favoriteGenres.includes(book.genre)) score += 30;
  
  // Age level match (0-20 points)
  if (book.ageLevel === userProfile.preferredAgeLevel) score += 20;
  
  // Community rating (0-20 points)
  score += (book.averageRating / 5) * 20;
  
  // Similar to liked books (0-30 points)
  const similarity = calculateBookSimilarity(book, userProfile.likedBooks);
  score += similarity * 30;
  
  return score; // 0-100
}
```

**Design:**
```
┌──────────────────────────────┐
│  ספרים מומלצים עבורך          │
│  [□ רק זמינים]               │
├──────────────────────────────┤
│  📕 שם הספר                  │
│     מחבר                     │
│     ⭐⭐⭐⭐⭐ (15)              │
│     התאמה: 92%               │
│     💬 בגלל שאהבת "הארי פוטר"│
│     🟢 זמין אצל 3 משפחות     │
│     [הצג פרטים]              │
├──────────────────────────────┤
│  📗 שם הספר 2...             │
└──────────────────────────────┘
```

**Testing:**
- [x] Recommendations based on user activity
- [x] Score calculated correctly
- [x] Explanation makes sense
- [x] Available filter works
- [x] No duplicates of owned books
- [x] E2E tests (20 tests covering all scenarios)

---

## 📸 Phase 7: Bulk Book Upload (AI Vision)

**Priority:** MEDIUM
**Estimated Time:** 6-8 hours
**Dependencies:** Phase 3 complete
**Status:** Ready for implementation

### Overview
Allow users to quickly add multiple books by taking a photo of their bookshelf. The app uses AI vision to detect book titles and authors from the image, then displays them in a compact list for user review before adding to the catalog.

---

### 7.1 Image Capture Interface
**Files to create:**
- `frontend/src/pages/BulkUpload.tsx`
- `frontend/src/components/ImageCaptureDialog.tsx`

**Features:**
- Two upload options:
  - **Upload from device** - file picker for existing images
  - **Use camera** - direct camera capture (mobile-optimized)
- Image preview before submission
- Clear/retake option
- Loading animation during AI processing
- Progress indicator with status messages

**API Endpoints:**
- `POST /api/books/detect-from-image` (need to implement)

**Design:**
```
┌──────────────────────────────┐
│  הוספת ספרים מתמונה           │
├──────────────────────────────┤
│  [📤 בחר תמונה]               │
│  [📷 צלם]                     │
│                              │
│  ┌────────────────┐          │
│  │                │          │
│  │   [תמונה]      │          │
│  │                │          │
│  └────────────────┘          │
│                              │
│  [🗑️ הסר]  [✓ זהה ספרים]    │
└──────────────────────────────┘
```

**Loading State:**
```
┌──────────────────────────────┐
│  מזהה ספרים...               │
├──────────────────────────────┤
│  ⏳ [=========>    ] 60%      │
│                              │
│  מעבד תמונה...               │
│  זיהוי ספרים...              │
└──────────────────────────────┘
```

---

### 7.2 Backend AI Integration (Gemini 1.5 Flash)
**Files to create:**
- `api/services/aiVisionService.js` - Abstract AI service layer
- `api/services/geminiVision.js` - Gemini implementation
- `api/routes/bulkUpload.js` - Bulk upload routes

**Architecture - Service Abstraction:**
```javascript
// api/services/aiVisionService.js
// Abstract interface for easy AI provider switching

class AIVisionService {
  async detectBooksFromImage(imageBuffer) {
    throw new Error('Must be implemented by subclass')
  }
}

export default AIVisionService
```

```javascript
// api/services/geminiVision.js
import { GoogleGenerativeAI } from '@google/generative-ai'
import AIVisionService from './aiVisionService.js'

class GeminiVisionService extends AIVisionService {
  constructor() {
    super()
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
  }

  async detectBooksFromImage(imageBuffer) {
    const prompt = `
      Analyze this image of a bookshelf and extract all visible book titles and authors.
      Return the results as a JSON array with the following structure:
      [
        { "title": "Book Title", "author": "Author Name" },
        ...
      ]
      
      Rules:
      - Only include books where the title is clearly readable
      - Include author name if visible on the spine/cover
      - don't include author if not visible
      - Return valid JSON only, no additional text
      - Support Hebrew and English titles
    `

    const imagePart = {
      inlineData: {
        data: imageBuffer.toString('base64'),
        mimeType: 'image/jpeg'
      }
    }

    const result = await this.model.generateContent([prompt, imagePart])
    const response = await result.response
    const text = response.text()
    
    // Parse JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('No valid JSON found in AI response')
    }
    
    return JSON.parse(jsonMatch[0])
  }
}

export default GeminiVisionService
```

**API Implementation:**
```javascript
// In api/index.js
import GeminiVisionService from './services/geminiVision.js'
import multer from 'multer'

// Keep images in memory (not saved to disk)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
})

const aiVisionService = new GeminiVisionService()

app.post('/api/books/detect-from-image', 
  authenticateUser,
  upload.single('image'), 
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image provided' })
      }

      // Detect books using AI
      const detectedBooks = await aiVisionService.detectBooksFromImage(
        req.file.buffer
      )

      // Enrich with additional data (optional)
      // Could search Google Books API for each detected book
      
      res.json({ 
        success: true, 
        books: detectedBooks,
        count: detectedBooks.length
      })
    } catch (error) {
      console.error('Image detection error:', error)
      res.status(500).json({ 
        error: 'Failed to detect books from image',
        details: error.message 
      })
    }
  }
)
```

**Environment Variables:**
```bash
# .env.development.local (local development)
GEMINI_API_KEY=your_gemini_api_key_here

# Vercel Environment Variables (production)
# Add GEMINI_API_KEY in Vercel dashboard under Settings > Environment Variables
```

**Dependencies to install:**
```bash
cd api
npm install @google/generative-ai multer
```

---

### 7.3 Review and Confirm Detected Books
**Files to create:**
- `frontend/src/components/DetectedBooksList.tsx`
- `frontend/src/components/DetectedBookRow.tsx`
- `frontend/src/components/EditDetectedBookDialog.tsx`

**Features:**
- Compact list view of detected books
- Each book row shows:
  - Checkbox (selected by default)
  - Book title
  - Author name
  - Edit button (opens inline edit form)
  - Remove button
- Bulk actions:
  - Select all / Deselect all
  - Confirm and add selected books
- Individual book editing:
  - Edit title and author
  - Add additional details (genre, year, etc.)
  - Save changes inline
- Success feedback with count of books added

**Design (Compact List):**
```
┌──────────────────────────────┐
│  ספרים שזוהו (12 ספרים)       │
│  [☑ בחר הכל]  [⬜ בטל הכל]    │
├──────────────────────────────┤
│  ☑ הארי פוטר                 │
│     ג'יי.קיי רולינג           │
│     [✏️]  [🗑️]                │
├──────────────────────────────┤
│  ☑ הוביט                     │
│     ג.ר.ר. טולקין             │
│     [✏️]  [🗑️]                │
├──────────────────────────────┤
│  ☑ 1984                      │
│     George Orwell            │
│     [✏️]  [🗑️]                │
├──────────────────────────────┤
│  ⚠️ ספר לא מזוהה             │
│     לא ידוע                  │
│     [✏️]  [🗑️]                │
├──────────────────────────────┤
│                              │
│  [הוסף 11 ספרים]  [ביטול]   │
└──────────────────────────────┘
```

**Edit Dialog (Inline or Modal):**
```
┌──────────────────────────────┐
│  ערוך פרטי ספר                │
├──────────────────────────────┤
│  שם הספר: [הארי פוטר]        │
│  מחבר: [ג'יי.קיי רולינג]     │
│                              │
│  [שמור]  [ביטול]             │
└──────────────────────────────┘
```

---

### 7.4 Bulk Add to Catalog
**API Endpoint:**
- `POST /api/books/bulk-add` (need to implement)

**Implementation:**
```javascript
// In api/index.js
app.post('/api/books/bulk-add', authenticateUser, async (req, res) => {
  try {
    const { books } = req.body // Array of book objects
    const familyId = req.user.familyId
    
    if (!Array.isArray(books) || books.length === 0) {
      return res.status(400).json({ error: 'No books provided' })
    }

    // Validate and add each book
    const addedBooks = []
    const errors = []
    
    for (const book of books) {
      try {
        // Basic validation
        if (!book.title || !book.author) {
          errors.push({ book, error: 'Missing title or author' })
          continue
        }
        
        // Insert book into database
        const result = await db.books.create({
          ...book,
          familyId,
          status: 'available',
          addedBy: req.user.id
        })
        
        addedBooks.push(result)
      } catch (error) {
        errors.push({ book, error: error.message })
      }
    }

    res.json({
      success: true,
      added: addedBooks.length,
      failed: errors.length,
      books: addedBooks,
      errors: errors
    })
  } catch (error) {
    console.error('Bulk add error:', error)
    res.status(500).json({ error: 'Failed to add books' })
  }
})
```

---

### 7.5 Testing Checklist
- [ ] Image upload works (file picker)
- [ ] Camera capture works on mobile
- [ ] AI detects book titles correctly (Hebrew + English)
- [ ] Loading animation displays during processing
- [ ] Detected books list shows all results
- [ ] Can edit individual book details
- [ ] Can remove false positives
- [ ] Select/deselect all works
- [ ] Bulk add successfully creates books
- [ ] Error handling for:
  - Invalid image format
  - Image too large (>10MB)
  - AI service failure
  - Network timeout
  - Duplicate books
- [ ] Environment variable (GEMINI_API_KEY) works locally and on Vercel

---

### 7.6 Future Enhancements
- Support for other AI providers (OpenAI Vision, Azure Vision)
- Batch processing multiple images
- Auto-match with Google Books API for complete metadata
- Save processing history
- Confidence score for each detected book
- Manual correction suggestions

---

## 🎨 Phase 8: UI/UX Enhancements

**Priority:** MEDIUM
**Estimated Time:** 3-4 hours
**Dependencies:** Core features complete

### 8.1 Home Page / Dashboard
**Files to create:**
- `frontend/src/pages/Home.tsx`
- `frontend/src/components/QuickStats.tsx`
- `frontend/src/components/RecentActivity.tsx`
- `frontend/src/components/QuickActions.tsx`

**Features:**
- Welcome message with user name
- Quick stats:
  - Books in catalog
  - Active loans
  - Pending requests
  - Community size
- Recent activity feed:
  - New books added
  - Loans activity
  - New reviews
- Quick actions:
  - Add book
  - Search books
  - View loans
  - View recommendations

**Design:**
```
┌──────────────────────────────┐
│  שלום, דוד! 👋                │
├──────────────────────────────┤
│  📊 סטטיסטיקות                │
│  📚 47 ספרים  🔄 5 השאלות    │
│  ⏳ 2 בקשות   👥 23 משפחות   │
├──────────────────────────────┤
│  📰 פעילות אחרונה            │
│  • משפחת לוי הוסיפה ספר חדש │
│  • השאלה הוחזרה מ...         │
│  • ביקורת חדשה על...         │
├──────────────────────────────┤
│  ⚡ פעולות מהירות             │
│  [➕ הוסף ספר]               │
│  [🔍 חפש ספרים]              │
│  [⭐ המלצות]                 │
└──────────────────────────────┘
```

---

### 8.2 Notifications System
**Files to create:**
- `frontend/src/components/NotificationBell.tsx`
- `frontend/src/components/NotificationsList.tsx`
- `frontend/src/pages/Notifications.tsx`

**Features:**
- Bell icon in top navigation
- Badge with unread count
- Dropdown with recent notifications
- Click to mark as read
- Types of notifications:
  - Loan request received
  - Loan request approved/rejected
  - Book returned
  - New review on your book
  - Book you want is now available
- "View all" link to notifications page

**API Endpoints:**
- `GET /api/notifications?userId=:id` (need to implement)
- `PUT /api/notifications/:id/read` (need to implement)

**Database Table:**
```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    link VARCHAR(255),
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

### 8.3 Mobile Responsiveness
**Files to modify:** All pages and components

**Features:**
- Bottom navigation on mobile
- Hamburger menu for mobile
- Touch-friendly buttons (44px min)
- Swipe gestures where appropriate
- Responsive grid layouts
- Mobile-optimized forms
- Collapsible sections

**Testing:**
- [ ] Test on iPhone (Safari)
- [ ] Test on Android (Chrome)
- [ ] Test on tablet
- [ ] Portrait and landscape
- [ ] All interactions work with touch

---

### 8.4 Loading States and Error Handling
**Files to create:**
- `frontend/src/components/LoadingSpinner.tsx`
- `frontend/src/components/ErrorMessage.tsx`
- `frontend/src/components/EmptyState.tsx`

**Features:**
- Show loading spinner during API calls
- Display error messages clearly
- Provide retry button on errors
- Empty states with helpful messages:
  - "No books yet - add your first book!"
  - "No loans yet"
  - "No search results found"
- Success messages/toasts
- Confirmation dialogs

**Testing:**
- [ ] Loading states visible
- [ ] Errors display correctly
- [ ] Retry functionality works
- [ ] Empty states helpful
- [ ] Success feedback clear

---

## 🔐 Phase 9: Security and Performance

**Priority:** HIGH (before production)
**Estimated Time:** 2-3 hours
**Dependencies:** All core features complete

### 9.1 Security Audit
**Checklist:**
- [x] RLS policies on all tables
- [ ] API endpoints validate user permissions
- [ ] No sensitive data exposed in client
- [ ] CORS properly configured
- [ ] Rate limiting on API
- [ ] Input validation and sanitization
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] CSRF protection
- [ ] Secure password handling
- [ ] Environment variables secured

**Files to review:**
- `api/index.js` - All endpoints
- `database/schema.sql` - RLS policies
- `frontend/` - No sensitive data in code

---

### 9.2 Performance Optimization
**Tasks:**
- [ ] Add indexes to database:
  - books(family_id)
  - loans(borrower_family_id)
  - loans(owner_family_id)
  - reviews(book_id)
  - likes(user_id)
- [ ] Implement pagination on lists
- [ ] Add caching for common queries
- [ ] Optimize images (compression, lazy loading)
- [ ] Code splitting on frontend
- [ ] Bundle size optimization
- [ ] API response time monitoring

**Database Indexes:**
```sql
CREATE INDEX idx_books_family_id ON books(family_id);
CREATE INDEX idx_loans_borrower ON loans(borrower_family_id);
CREATE INDEX idx_loans_owner ON loans(owner_family_id);
CREATE INDEX idx_reviews_book ON reviews(book_id);
CREATE INDEX idx_likes_user ON likes(user_id);
```

---

### 9.3 Testing Coverage
**Current Status:** 153 E2E tests implemented with Playwright ✅

**Tasks:**
- [x] Install Playwright and configure
- [x] Add E2E tests for authentication flow
- [x] Add E2E tests for registration validation
- [x] Add E2E tests for duplicate user prevention
- [x] Add E2E tests for shared email support
- [x] Add E2E tests for books management (CRUD)
- [x] Add E2E tests for family management
- [x] Add E2E tests for profile page
- [x] Add E2E tests for home dashboard
- [x] Add E2E tests for responsive design
- [x] Add E2E tests for RTL support
- [x] Add E2E tests for accessibility
- [x] Add E2E tests for network errors
- [x] Add E2E tests for invalid data validation
- [x] Add E2E tests for concurrent operations
- [x] Add E2E tests for browser compatibility
- [x] Add E2E tests for XSS/SQL injection protection
- [x] Add E2E tests for permission checks
- [x] Add E2E tests for Reviews and Ratings (Phase 6)
- [x] Add E2E tests for Likes functionality (Phase 6)
- [x] Add E2E tests for Recommendations (Phase 6)
- [ ] Fix failing unit tests (5 tests failing)
- [ ] Add frontend component tests
- [ ] Add integration tests
- [ ] Test error scenarios (additional edge cases)

**E2E Test Coverage:**
- ✅ Authentication (19 tests):
  - Login validation (empty, invalid, wrong)
  - Registration with new family
  - Duplicate user prevention
  - Shared email for family members
  - Password & email validation
  - Logout and session clearing
  
- ✅ Books Management (16 tests): 
  - CRUD operations
  - Search, filters, sort
  - Series support
  - Owner permissions
  
- ✅ Family Management (11 tests): 
  - Dashboard, members
  - Admin features
  
- ✅ Profile (10 tests): 
  - View, edit, family info
  
- ✅ Home Dashboard (7 tests): 
  - Search, stats, navigation
  
- ✅ Responsive Design (8 tests): 
  - Mobile, tablet, RTL
  
- ✅ Accessibility (6 tests): 
  - Labels, keyboard, screen readers
  - Network errors (timeout, 500, 404, retries)
  - Invalid data validation
  - Concurrent operations
  - Browser compatibility
  - XSS/SQL injection protection
  - Permission enforcement

- ✅ Reviews and Ratings (18 tests):
  - Add/view/delete reviews
  - 1-5 star rating system
  - Sort options (newest, highest, lowest)
  - Average rating display
  - Duplicate prevention
  - Own review management

- ✅ Likes Functionality (15 tests):
  - Like/unlike toggle
  - Like count display
  - Visual feedback (heart icon)
  - State persistence
  - Integration with book cards
  - Rapid click handling

- ✅ Recommendations (20 tests):
  - Personalized recommendations
  - Match percentage display
  - Recommendation reasons
  - Availability filtering
  - Algorithm-based scoring
  - Empty state handling

**Testing Priorities:**
1. ✅ Authentication flow with validation
2. ✅ User registration (new family, existing family, duplicates)
3. ✅ Book CRUD operations
4. ✅ Family management
5. ✅ Error handling and security
6. ✅ Responsive and accessible design
7. ✅ Reviews and Ratings (Phase 6)
8. ✅ Likes functionality (Phase 6)
9. ✅ Recommendations (Phase 6)
10. Loan workflow (pending Phase 5)
11. Search functionality (pending Phase 4)

---

## 🚀 Phase 10: Deployment and Monitoring

**Priority:** HIGH (before production)
**Estimated Time:** 2-3 hours

### 10.1 Production Deployment
**Checklist:**
- [ ] Environment variables in Vercel
- [ ] Database migrations applied
- [ ] RLS policies verified
- [ ] CORS configured for production domain
- [ ] Error logging (Sentry, LogRocket)
- [ ] Analytics (Google Analytics, Mixpanel)
- [ ] Performance monitoring (Vercel Analytics)
- [ ] Backup strategy for database

---

### 10.2 User Documentation
**Files to create:**
- `USER_GUIDE.md` (Hebrew)
- `FAQ.md` (Hebrew)

**Content:**
- Getting started guide
- How to add books
- How to search for books
- How to borrow books
- How to manage loans
- How to write reviews
- Family management
- Troubleshooting

---

## 🎯 Feature Priority Matrix

### Must Have (Phase 1-5)
- ✅ Authentication
- ✅ Family management
- ✅ Book catalog (CRUD)
- ✅ Community search
- ✅ Loans management

### Should Have (Phase 6-8)
- Reviews and ratings
- Recommendations
- Home dashboard
- Notifications
- Mobile optimization

### Nice to Have (Phase 7, 9-10)
- OCR bulk upload
- Advanced analytics
- Community events
- Map integration

---

## 📋 Development Workflow

### For Each Feature:
1. **Plan:** Review requirements from this guide
2. **Design:** Sketch UI if needed
3. **Database:** Add/modify tables if needed
4. **API:** Implement backend endpoints
5. **Frontend:** Build UI components
6. **Test:** Write and run tests
7. **Review:** Check against requirements
8. **Document:** Update this guide with "✅ Complete"

### Git Workflow:
```bash
# Create feature branch
git checkout -b feature/book-catalog

# Implement feature
git add .
git commit -m "feat: add book catalog view"

# Push and deploy
git push origin feature/book-catalog
# Merges to main auto-deploy on Vercel
```

---

## 🐛 Known Issues and TODOs

### Critical (Fix Immediately)
1. ⚠️ **RLS INSERT policy missing for users table**
   - **Impact:** Cannot register additional family members
   - **Fix:** Run SQL in database/migrations/003_add_users_insert_policy.sql
   - **Status:** SQL file created, needs application

### High Priority
1. Complete authentication module (Phase 1)
2. Fix failing tests (5 tests failing)
3. Add pagination to book lists

### Medium Priority
1. Add input validation to all forms
2. Implement error boundaries
3. Add loading skeletons

### Low Priority
1. Add dark mode
2. Add export catalog feature
3. Add book statistics page

---

## 📊 Progress Tracking

**Overall Progress:** ~60% Complete

| Phase | Status | Progress | Est. Time | Actual Time |
|-------|--------|----------|-----------|-------------|
| 0. Infrastructure | ✅ Complete | 100% | 8h | ~10h |
| 1. Authentication | 🔄 In Progress | 75% | 2-3h | ~2h |
| 2. Family Management | ✅ Complete | 100% | 3-4h | ~3h |
| 3. Books Management | ✅ Complete | 100% | 6-8h | ~4h |
| 4. Community Search | ⏳ Planned | 0% | 4-5h | - |
| 5. Loans Management | ⏳ Planned | 0% | 5-6h | - |
| 6. Reviews & Recs | ✅ Complete | 100% | 4-5h | ~5h |
| 7. AI Bulk Upload | ⏳ Documented | 0% | 6-8h | - |
| 8. UI/UX | ⏳ Planned | 0% | 3-4h | - |
| 9. Security | ⏳ Planned | 0% | 2-3h | - |
| 10. Deployment | ⏳ Planned | 0% | 2-3h | - |

**Total Estimated:** 40-50 hours
**Completed:** ~24 hours
**Remaining:** ~23 hours

---

## 🎓 Learning Resources

### Google Books API
- [API Documentation](https://developers.google.com/books)
- [Hebrew Book Search Example](https://www.googleapis.com/books/v1/volumes?q=הארי+פוטר&langRestrict=he)

### OCR Services
- [Tesseract.js](https://tesseract.projectnaptha.com/)
- [Google Cloud Vision](https://cloud.google.com/vision)
- [Azure Computer Vision](https://azure.microsoft.com/en-us/services/cognitive-services/computer-vision/)

### WhatsApp Integration
- [wa.me Links](https://faq.whatsapp.com/general/chats/how-to-use-click-to-chat)
- Format: `https://wa.me/972501234567?text=Hello`

---

## 📞 Support and Questions

When implementing each phase, refer back to:
1. Original PRD (Hebrew) for requirements
2. This implementation guide for technical details
3. `COPILOT_INSTRUCTIONS.md` for architecture patterns

**Current Status:** Phase 6 (Reviews & Recommendations) Complete with E2E Tests

**Next Action:** Apply database migration 004_add_rating_to_reviews.sql or continue with Phase 4/5

---

## 🔮 Future Tasks and Improvements

### High Priority

#### 1. Environment Separation
**Goal:** Create completely separate development and production environments

**Tasks:**
- [ ] Create separate Vercel projects for dev and prod
- [ ] Set up separate Supabase databases:
  - `community-library-dev` - Development database
  - `community-library-prod` - Production database
- [ ] Configure local development to use dev database
- [ ] Update `.env.development.local` to point to dev database
- [ ] Update Vercel production environment variables to use prod database
- [ ] Document environment-specific configurations
- [ ] Add database migration workflow for both environments
- [ ] Set up separate API keys for each environment (Gemini, OpenAI, etc.)

**Benefits:**
- Safe testing without affecting production data
- Isolated environments prevent accidental data corruption
- Different API quotas and rate limits per environment
- Ability to test breaking changes safely

---

#### 2. E2E Tests Environment Configuration
**Goal:** Enable running E2E tests on both local and Vercel deployments

**Tasks:**
- [ ] Add environment variable `TEST_ENV` (values: `local`, `dev`, `prod`)
- [ ] Create `playwright.config.local.ts` - Tests against `http://localhost:5174`
- [ ] Create `playwright.config.dev.ts` - Tests against Vercel dev deployment
- [ ] Update test scripts in `package.json`:
  ```json
  {
    "test:e2e:local": "playwright test --config=playwright.config.local.ts",
    "test:e2e:dev": "playwright test --config=playwright.config.dev.ts",
    "test:e2e:ci": "playwright test --config=playwright.config.dev.ts --reporter=github"
  }
  ```
- [ ] Configure separate test data fixtures for each environment
- [ ] Add GitHub Actions workflow to run E2E tests on dev deployment
- [ ] Document how to run tests against different environments
- [ ] Add test cleanup scripts to reset test data

**Benefits:**
- Test on actual Vercel infrastructure before production
- Catch deployment-specific issues (serverless, edge functions)
- CI/CD pipeline validates changes before merge
- Local testing remains fast and independent

---

#### 3. Backend Refactoring - Route Organization
**Goal:** Extract route logic from `api/index.js` into modular, maintainable files

**Current Structure (Problem):**
```
api/
  index.js (677 lines - contains ALL routes and logic)
  db/
    adapter.js
  services/
    geminiVision.js
```

**Target Structure:**
```
api/
  index.js (main server setup, middleware, ~50 lines)
  routes/
    auth.routes.js
    families.routes.js
    users.routes.js
    books.routes.js
    loans.routes.js
    reviews.routes.js
    likes.routes.js
    recommendations.routes.js
    bulkUpload.routes.js
  controllers/
    auth.controller.js
    books.controller.js
    loans.controller.js
    ...
  services/
    geminiVision.js
    bookSearch.js
    recommendations.js
  middleware/
    auth.middleware.js
    validation.middleware.js
    errorHandler.middleware.js
  db/
    adapter.js
```

**Tasks:**
- [ ] Create `api/routes/` directory
- [ ] Create `api/controllers/` directory
- [ ] Extract authentication routes to `auth.routes.js` + `auth.controller.js`
- [ ] Extract books routes to `books.routes.js` + `books.controller.js`
- [ ] Extract loans routes to `loans.routes.js` + `loans.controller.js`
- [ ] Extract families routes to `families.routes.js` + `families.controller.js`
- [ ] Extract users routes to `users.routes.js` + `users.controller.js`
- [ ] Extract reviews routes to `reviews.routes.js` + `reviews.controller.js`
- [ ] Extract likes routes to `likes.routes.js` + `likes.controller.js`
- [ ] Extract recommendations routes to `recommendations.routes.js` + `recommendations.controller.js`
- [ ] Extract bulk upload routes to `bulkUpload.routes.js` + `bulkUpload.controller.js`
- [ ] Move authentication middleware to `middleware/auth.middleware.js`
- [ ] Create validation middleware in `middleware/validation.middleware.js`
- [ ] Create centralized error handler in `middleware/errorHandler.middleware.js`
- [ ] Update `api/index.js` to import and use routes:
  ```javascript
  import authRoutes from './routes/auth.routes.js'
  import booksRoutes from './routes/books.routes.js'
  // ...
  
  app.use('/api/auth', authRoutes)
  app.use('/api/books', booksRoutes)
  // ...
  ```
- [ ] Add JSDoc comments to all controllers
- [ ] Create unit tests for each controller
- [ ] Update documentation with new structure

**Example Structure:**
```javascript
// api/routes/books.routes.js
import express from 'express'
import { authenticateUser } from '../middleware/auth.middleware.js'
import { validateBook } from '../middleware/validation.middleware.js'
import * as booksController from '../controllers/books.controller.js'

const router = express.Router()

router.get('/', booksController.getAllBooks)
router.get('/search', booksController.searchBooks)
router.get('/:id', booksController.getBookById)
router.post('/', authenticateUser, validateBook, booksController.createBook)
router.put('/:id', authenticateUser, validateBook, booksController.updateBook)
router.delete('/:id', authenticateUser, booksController.deleteBook)

export default router
```

```javascript
// api/controllers/books.controller.js
import { db } from '../db/adapter.js'

/**
 * Get all books with optional filters
 * @route GET /api/books
 */
export async function getAllBooks(req, res) {
  try {
    const { familyId, status, title, author, genre, series } = req.query
    const books = await db.books.getAll({
      familyId, status, title, author, genre, series
    })
    res.json({ books })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// ... other controller functions
```

**Benefits:**
- **Maintainability:** Each route group in separate file (~100-200 lines)
- **Testability:** Controllers can be unit tested independently
- **Readability:** Clear separation of concerns (routing, logic, validation)
- **Scalability:** Easy to add new routes without modifying massive file
- **Collaboration:** Multiple developers can work on different route files
- **Reusability:** Controllers can be shared across different route configurations

---

### Medium Priority

#### 4. Frontend Refactoring

##### 4.1 API Access Layer
**Goal:** Centralize all API calls in a dedicated service layer

**Current Problem:**
- Fetch calls scattered across components
- Duplicate error handling logic
- No centralized token management
- Hard to mock for testing

**Target Structure:**
```
frontend/src/
  services/
    api/
      apiClient.ts          # Base HTTP client (axios/fetch wrapper)
      auth.api.ts           # Authentication API calls
      books.api.ts          # Books API calls
      loans.api.ts          # Loans API calls
      families.api.ts       # Families API calls
      users.api.ts          # Users API calls
      reviews.api.ts        # Reviews API calls
      likes.api.ts          # Likes API calls
      recommendations.api.ts # Recommendations API calls
  hooks/
    useApi.ts              # Custom hook for API calls with loading/error states
```

**Tasks:**
- [ ] Install `axios` for better HTTP client: `npm install axios`
- [ ] Create `apiClient.ts` with base configuration:
  ```typescript
  import axios from 'axios'
  
  const apiClient = axios.create({
    baseURL: '/api',
    headers: {
      'Content-Type': 'application/json'
    }
  })
  
  // Add token to all requests
  apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  })
  
  // Handle errors globally
  apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        // Redirect to login
        window.location.href = '/login'
      }
      return Promise.reject(error)
    }
  )
  
  export default apiClient
  ```
- [ ] Create API service files for each resource
- [ ] Create `useApi` hook for components:
  ```typescript
  export function useApi<T>(apiCall: () => Promise<T>) {
    const [data, setData] = useState<T | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    
    const execute = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await apiCall()
        setData(result)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    
    return { data, loading, error, execute }
  }
  ```
- [ ] Migrate all components to use API services
- [ ] Remove all direct `fetch` calls from components
- [ ] Add TypeScript types for all API responses
- [ ] Add retry logic for failed requests
- [ ] Add request cancellation for unmounted components

**Example Usage:**
```typescript
// Before (in component)
const [books, setBooks] = useState([])
const [loading, setLoading] = useState(false)

useEffect(() => {
  setLoading(true)
  fetch('/api/books')
    .then(res => res.json())
    .then(data => setBooks(data.books))
    .catch(err => console.error(err))
    .finally(() => setLoading(false))
}, [])

// After (in component)
import { booksApi } from '@/services/api/books.api'
import { useApi } from '@/hooks/useApi'

const { data: books, loading, error } = useApi(() => booksApi.getAll())
```

**Benefits:**
- Single source of truth for API endpoints
- Centralized error handling and retry logic
- Easier to mock for testing
- Type-safe API calls with TypeScript
- Consistent loading and error states

---

##### 4.2 State Management with Local Caching
**Goal:** Implement client-side caching to reduce redundant API calls

**Current Problem:**
- Every component refetches same data
- No data persistence between page navigations
- Slow user experience with frequent loading states
- Excessive API calls waste bandwidth and server resources

**Recommended Solution: TanStack Query (React Query)**

**Why TanStack Query:**
- ✅ Industry standard for React data fetching
- ✅ Built-in caching and background refetching
- ✅ Automatic stale-while-revalidate pattern
- ✅ Optimistic updates
- ✅ TypeScript support
- ✅ DevTools for debugging
- ✅ Minimal boilerplate

**Tasks:**
- [ ] Install TanStack Query: `npm install @tanstack/react-query @tanstack/react-query-devtools`
- [ ] Set up QueryClient in `main.tsx`:
  ```typescript
  import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
  import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
  
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        cacheTime: 10 * 60 * 1000, // 10 minutes
        refetchOnWindowFocus: false,
        retry: 1
      }
    }
  })
  
  root.render(
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
  ```
- [ ] Create custom hooks for each resource:
  ```typescript
  // hooks/queries/useBooks.ts
  import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
  import { booksApi } from '@/services/api/books.api'
  
  export function useBooks(filters?: BookFilters) {
    return useQuery({
      queryKey: ['books', filters],
      queryFn: () => booksApi.getAll(filters)
    })
  }
  
  export function useBook(id: string) {
    return useQuery({
      queryKey: ['books', id],
      queryFn: () => booksApi.getById(id),
      enabled: !!id
    })
  }
  
  export function useCreateBook() {
    const queryClient = useQueryClient()
    
    return useMutation({
      mutationFn: booksApi.create,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['books'] })
      }
    })
  }
  
  export function useUpdateBook() {
    const queryClient = useQueryClient()
    
    return useMutation({
      mutationFn: ({ id, data }) => booksApi.update(id, data),
      onSuccess: (_, { id }) => {
        queryClient.invalidateQueries({ queryKey: ['books'] })
        queryClient.invalidateQueries({ queryKey: ['books', id] })
      }
    })
  }
  ```
- [ ] Create similar hooks for: loans, families, users, reviews, likes, recommendations
- [ ] Migrate all components to use query hooks
- [ ] Configure cache invalidation strategies:
  - Invalidate books cache when adding/editing/deleting book
  - Invalidate loans cache when creating/returning loan
  - Invalidate recommendations cache when liking book
- [ ] Add optimistic updates for instant UI feedback
- [ ] Configure background refetching for frequently changing data
- [ ] Add prefetching for predictable navigation patterns

**Example Usage:**
```typescript
// Before (in component)
const [books, setBooks] = useState([])
const [loading, setLoading] = useState(false)

useEffect(() => {
  setLoading(true)
  booksApi.getAll()
    .then(setBooks)
    .finally(() => setLoading(false))
}, [])

// After (in component)
import { useBooks } from '@/hooks/queries/useBooks'

function MyBooks() {
  const { data: books, isLoading, error } = useBooks({ familyId: user.familyId })
  
  if (isLoading) return <Loading />
  if (error) return <Error message={error.message} />
  
  return <BooksList books={books} />
}
```

**Caching Strategy by Data Type:**

| Data Type | Stale Time | Refetch Strategy | Reason |
|-----------|------------|------------------|--------|
| User Profile | 10 min | On login | Rarely changes |
| Books Catalog | 5 min | On mutation | Changes frequently |
| Loans | 2 min | On mutation + interval | Needs to be fresh |
| Reviews | 5 min | On mutation | Medium frequency |
| Likes | 5 min | On mutation | Medium frequency |
| Recommendations | 30 min | Manual refresh | Expensive to compute |
| Families | 10 min | On mutation | Rarely changes |
| Search Results | 1 min | On search | Should be fresh |

**Benefits:**
- ⚡ **Performance:** Data cached in memory, instant page loads
- 🔄 **Smart Refetching:** Automatic background updates keep data fresh
- 📶 **Offline Support:** Works with cached data when offline
- 🎯 **Optimistic Updates:** Instant UI feedback before server responds
- 🐛 **Easier Debugging:** DevTools show cache state and queries
- 📉 **Reduced API Calls:** 70-90% reduction in redundant requests
- 🧪 **Testability:** Easy to mock query responses
- 🚀 **Better UX:** No loading spinners for cached data

---

## 📝 Implementation Priority Order

1. **Environment Separation** (1-2 days)
   - Critical for safe development
   - Should be done before adding more features

2. **Backend Refactoring** (2-3 days)
   - Makes future development faster
   - Improves code quality and maintainability

3. **Frontend API Layer** (1-2 days)
   - Foundation for state management
   - Immediate improvement in code quality

4. **State Management** (2-3 days)
   - Biggest UX improvement
   - Reduces server load

5. **E2E Test Configuration** (1 day)
   - Enables testing on Vercel
   - Completes testing infrastructure

**Total Estimated Time:** 7-11 days

---

*Last Updated: November 27, 2025*
*Version: 1.1*
