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
**Estimated Time:** 5-6 hours
**Dependencies:** Phase 4 complete

### 5.1 Request Book Loan
**Files to create:**
- `frontend/src/components/LoanRequestDialog.tsx`
- `frontend/src/pages/LoanRequest.tsx`

**Features:**
- Request loan from book details page
- Select which family to request from (if multiple)
- Add optional message/note
- Suggest return date
- Send request notification (email/WhatsApp)
- Track request status

**API Endpoints:**
- `POST /api/loans` (already exists, may need enhancement)
- `POST /api/notifications` (need to implement)

**New API Implementation:**
```javascript
// In api/index.js
app.post('/api/loans', async (req, res) => {
  const { bookId, ownerFamilyId, borrowerFamilyId, notes, requestedReturnDate } = req.body;
  // Create loan request with status 'pending'
  // Send notification to owner family
  // Return loan details
});

app.post('/api/notifications', async (req, res) => {
  const { familyId, type, message, link } = req.body;
  // Send WhatsApp message (wa.me link)
  // Or email notification
  // Log notification
});
```

**Design:**
```
┌──────────────────────────────┐
│  בקשת השאלה                  │
├──────────────────────────────┤
│  ספר: הארי פוטר               │
│  מאת: משפחת כהן               │
│                              │
│  תאריך החזרה משוער:          │
│  [📅 01/12/2025]             │
│                              │
│  הערות (אופציונלי):          │
│  [_____________]             │
│                              │
│  [שלח בקשה]  [ביטול]         │
└──────────────────────────────┘
```

**Testing:**
- [ ] Request creates loan record
- [ ] Status set to 'pending'
- [ ] Notification sent to owner
- [ ] Cannot request if unavailable
- [ ] Can only request once

---

### 5.2 Loans Dashboard
**Files to create:**
- `frontend/src/pages/LoansDashboard.tsx`
- `frontend/src/components/LoansList.tsx`
- `frontend/src/components/LoanCard.tsx`

**Features:**
- View all loans in one place
- Tabs for:
  - **בקשות שקיבלנו** (Requests received) - pending approvals
  - **ספרים שהשאלנו** (Books we lent) - approved, active
  - **ספרים ששאלנו** (Books we borrowed) - our active loans
  - **היסטוריה** (History) - completed/rejected loans
- For each loan:
  - Book details
  - Other family name & contact
  - Status badge
  - Due date
  - Actions based on status

**API Endpoints (already exist):**
- `GET /api/loans?borrowerFamilyId=:id`
- `GET /api/loans?ownerFamilyId=:id`
- `GET /api/loans?status=pending`

**Design:**
```
┌──────────────────────────────┐
│  ניהול השאלות                 │
├──────────────────────────────┤
│  [בקשות שקיבלנו] [השאלנו]    │
│  [שאלנו] [היסטוריה]          │
├──────────────────────────────┤
│  📕 הארי פוטר                │
│     ל: משפחת לוי              │
│     📅 תאריך החזרה: 01/12    │
│     🟡 ממתין לאישור           │
│     [✅ אשר]  [❌ דחה]        │
├──────────────────────────────┤
│  📗 הוביט                    │
│     ל: משפחת אברהם            │
│     📅 תאריך החזרה: 15/12    │
│     🟢 פעיל                  │
│     [✓ סמן כהוחזר]           │
└──────────────────────────────┘
```

**Testing:**
- [ ] Tabs show correct loans
- [ ] Pending requests visible
- [ ] Active loans tracked
- [ ] History includes completed
- [ ] Contact info accessible

---

### 5.3 Approve/Reject Loan Request
**Files to create:**
- `frontend/src/components/LoanApprovalDialog.tsx`

**Features:**
- Owner can approve or reject request
- If approve:
  - Set actual return date
  - Add notes
  - Mark book as on loan
  - Send confirmation to borrower
- If reject:
  - Add reason (optional)
  - Send notification to borrower
  - Free up for other requests

**API Endpoints:**
- `PUT /api/loans/:id/approve` (need to implement)
- `PUT /api/loans/:id/reject` (need to implement)

**New API Implementation:**
```javascript
// In api/index.js
app.put('/api/loans/:id/approve', async (req, res) => {
  const { returnDate, notes } = req.body;
  // Update loan status to 'active'
  // Update book status to 'on_loan'
  // Send notification to borrower
  // Return updated loan
});

app.put('/api/loans/:id/reject', async (req, res) => {
  const { reason } = req.body;
  // Update loan status to 'rejected'
  // Send notification to borrower
  // Return updated loan
});
```

**Testing:**
- [ ] Approve updates status correctly
- [ ] Book marked as on loan
- [ ] Borrower receives notification
- [ ] Reject cancels request
- [ ] Book remains available

---

### 5.4 Return Book
**Files to create:**
- `frontend/src/components/ReturnBookDialog.tsx`

**Features:**
- Owner marks book as returned
- Add return date (auto-set to today)
- Optional rating/feedback on borrower
- Update book status to available
- Send confirmation to borrower
- Move loan to history

**API Endpoints:**
- `PUT /api/loans/:id/return` (need to implement)

**New API Implementation:**
```javascript
// In api/index.js
app.put('/api/loans/:id/return', async (req, res) => {
  const { actualReturnDate, notes } = req.body;
  // Update loan status to 'returned'
  // Set actual_return_date
  // Update book status to 'available'
  // Send notification to borrower
  // Return updated loan
});
```

**Testing:**
- [ ] Return marks book available
- [ ] Loan moves to history
- [ ] Both families notified
- [ ] Cannot return twice

---

## ⭐ Phase 6: Reviews and Recommendations Module

**Priority:** MEDIUM
**Estimated Time:** 4-5 hours
**Dependencies:** Phase 5 complete

### 6.1 Add Book Review
**Files to create:**
- `frontend/src/components/AddReviewDialog.tsx`
- `frontend/src/components/ReviewForm.tsx`

**Features:**
- Rate book (1-5 stars or like/dislike)
- Write review text
- Add to any book in community
- Cannot review same book twice
- Can edit own review
- Display reviewer name

**API Endpoints (already exist):**
- `POST /api/reviews`
- `PUT /api/reviews/:id`
- `DELETE /api/reviews/:id`

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
- [ ] Review saves successfully
- [ ] Rating displays correctly
- [ ] Cannot review same book twice
- [ ] Can edit own review
- [ ] Cannot edit others' reviews

---

### 6.2 Display Reviews on Book Page
**Files to modify:**
- `frontend/src/pages/BookDetails.tsx`
- `frontend/src/components/BookReviews.tsx`

**Features:**
- Show all reviews for book
- Display average rating
- Show reviewer name and date
- Sort by: newest, highest rated, lowest rated
- "Add review" button
- Edit/delete own review

**API Endpoints (already exist):**
- `GET /api/reviews?bookId=:id`

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
- [ ] Reviews display correctly
- [ ] Average rating calculated
- [ ] Sort options work
- [ ] Can only edit/delete own
- [ ] Add review opens dialog

---

### 6.3 Like/Unlike Books
**Files to create:**
- `frontend/src/components/LikeButton.tsx`

**Features:**
- Heart icon on book cards and details page
- Click to like/unlike
- Show like count
- Used for recommendations algorithm

**API Endpoints (already exist):**
- `POST /api/likes`
- `DELETE /api/likes/:id`
- `GET /api/likes?userId=:id`

**Testing:**
- [ ] Like adds record
- [ ] Unlike removes record
- [ ] Count updates immediately
- [ ] Cannot like twice
- [ ] Visual feedback on toggle

---

### 6.4 Recommendations Engine
**Files to create:**
- `frontend/src/pages/Recommendations.tsx`
- `frontend/src/components/RecommendedBookCard.tsx`

**Features:**
- Algorithm based on:
  - Books user liked
  - Books user reviewed (4+ stars)
  - Books user borrowed
  - Preferred genres
  - Age level matches
- Show "match percentage" or confidence score
- Explain why recommended ("based on your love of fantasy")
- Filter by availability
- Click to view book details

**API Endpoints:**
- `GET /api/recommendations?userId=:id` (need to implement)

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
- [ ] Recommendations based on user activity
- [ ] Score calculated correctly
- [ ] Explanation makes sense
- [ ] Available filter works
- [ ] No duplicates of owned books

---

## 📸 Phase 7: Bulk Book Upload (OCR)

**Priority:** LOW (Nice to have)
**Estimated Time:** 8-10 hours
**Dependencies:** Phase 3 complete
**Note:** Complex feature, consider third-party services

### 7.1 Image Upload Interface
**Files to create:**
- `frontend/src/pages/BulkUpload.tsx`
- `frontend/src/components/ImageUploader.tsx`

**Features:**
- Upload one or multiple images
- Preview uploaded images
- Rotate/crop if needed
- Submit for OCR processing
- Show progress indicator

**API Endpoints:**
- `POST /api/books/bulk-upload` (need to implement)

**Design:**
```
┌──────────────────────────────┐
│  העלאת קטלוג מתמונה           │
├──────────────────────────────┤
│  [📤 בחר תמונה]               │
│                              │
│  ┌────────────────┐          │
│  │                │          │
│  │   [תמונה]      │          │
│  │                │          │
│  └────────────────┘          │
│                              │
│  [סובב ◄]  [סובב ►]          │
│  [🗑️ הסר]                    │
│                              │
│  [העלה וזהה]                 │
└──────────────────────────────┘
```

---

### 7.2 OCR Processing
**Technology Options:**
1. **Google Cloud Vision API** (paid, very accurate)
2. **Tesseract.js** (free, open source, Hebrew support)
3. **Azure Computer Vision** (paid, good accuracy)
4. **AWS Textract** (paid)

**Implementation:**
```javascript
// In api/index.js
app.post('/api/books/bulk-upload', async (req, res) => {
  const { image } = req.body; // base64 or file upload
  
  // 1. Call OCR service
  const ocrText = await performOCR(image);
  
  // 2. Parse book titles from text
  const bookTitles = extractBookTitles(ocrText);
  
  // 3. Search each title online
  const booksData = await Promise.all(
    bookTitles.map(title => searchBookOnline(title))
  );
  
  // 4. Return results for user review
  res.json({ books: booksData });
});
```

---

### 7.3 Review and Confirm
**Files to create:**
- `frontend/src/pages/BulkUploadReview.tsx`
- `frontend/src/components/DetectedBookCard.tsx`

**Features:**
- Show all detected books
- Each book has:
  - Auto-filled data from search
  - Edit button
  - Remove button
  - Include checkbox
- Select all / deselect all
- Confirm and add to catalog
- Show success summary

**Design:**
```
┌──────────────────────────────┐
│  אישור ספרים שזוהו             │
│  נמצאו 12 ספרים               │
│  [☑ בחר הכל]  [⬜ בטל הכל]    │
├──────────────────────────────┤
│  ☑ 📕 הארי פוטר               │
│     ג'יי.קיי רולינג           │
│     [✏️ ערוך]  [🗑️ הסר]       │
├──────────────────────────────┤
│  ☑ 📗 הוביט                  │
│     ג.ר.ר. טולקין             │
│     [✏️ ערוך]  [🗑️ הסר]       │
├──────────────────────────────┤
│  [אשר והוסף 10 ספרים]        │
│  [ביטול]                     │
└──────────────────────────────┘
```

**Testing:**
- [ ] OCR detects book titles
- [ ] Online search finds matches
- [ ] Can edit detected books
- [ ] Can remove false positives
- [ ] Bulk add works correctly

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
**Current Status:** 8/13 tests passing

**Tasks:**
- [ ] Fix failing tests
- [ ] Add tests for all API endpoints
- [ ] Add frontend component tests
- [ ] Add integration tests
- [ ] Add E2E tests (Playwright/Cypress)
- [ ] Test error scenarios
- [ ] Test edge cases

**Testing Priorities:**
1. Authentication flow
2. Book CRUD operations
3. Loan workflow
4. Search functionality
5. Reviews and likes

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

**Overall Progress:** ~50% Complete

| Phase | Status | Progress | Est. Time | Actual Time |
|-------|--------|----------|-----------|-------------|
| 0. Infrastructure | ✅ Complete | 100% | 8h | ~10h |
| 1. Authentication | 🔄 In Progress | 75% | 2-3h | ~2h |
| 2. Family Management | ✅ Complete | 100% | 3-4h | ~3h |
| 3. Books Management | ✅ Complete | 100% | 6-8h | ~4h |
| 4. Community Search | ⏳ Planned | 0% | 4-5h | - |
| 5. Loans Management | ⏳ Planned | 0% | 5-6h | - |
| 6. Reviews & Recs | ⏳ Planned | 0% | 4-5h | - |
| 7. OCR Upload | ⏳ Planned | 0% | 8-10h | - |
| 8. UI/UX | ⏳ Planned | 0% | 3-4h | - |
| 9. Security | ⏳ Planned | 0% | 2-3h | - |
| 10. Deployment | ⏳ Planned | 0% | 2-3h | - |

**Total Estimated:** 40-50 hours
**Completed:** ~19 hours
**Remaining:** ~28 hours

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

**Current Status:** Ready to fix RLS policy and continue Phase 1

**Next Action:** Apply database migration 003_add_users_insert_policy.sql

---

*Last Updated: November 24, 2025*
*Version: 1.0*
