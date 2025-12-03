# Database Migrations

## How to Apply Migrations

### Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the migration file and copy its contents
4. Paste into the SQL Editor
5. Click **Run** to execute the migration

### Using Supabase CLI

```bash
# If you have Supabase CLI installed
supabase db push
```

## Migration Files

### 001_shared_books_catalog.sql
**Purpose:** Initial schema with shared book catalog pattern

**Changes:**
- Creates `book_catalog` table (shared book metadata)
- Creates `family_books` table (family ownership)
- Creates supporting tables (families, users, loans, reviews, likes)
- Adds initial indexes and constraints

### 002_add_auth_email_column.sql
**Purpose:** Adds support for multiple users with the same email address

**Changes:**
- Adds `auth_email` column to `users` table (stores unique email for Supabase Auth)
- Removes UNIQUE constraint from `email` column (allows sharing)
- Migrates existing users: sets `auth_email` = `email` for all existing records

**Required:** Yes, must run before using the shared email feature

**Safe to run multiple times:** Yes (uses `IF NOT EXISTS` and `IF EXISTS` checks)

### 003_add_users_insert_policy.sql
**Purpose:** Adds RLS policy for user registration

**Changes:**
- Creates RLS policy allowing users to insert their own records

### 004_add_rating_to_reviews.sql
**Purpose:** Adds rating field to reviews table

**Changes:**
- Adds `rating` integer column to `reviews` table
- Sets default value and adds CHECK constraint (1-5 stars)

### 005_add_series_number.sql
**Purpose:** Adds series tracking to books

**Changes:**
- Adds `series` and `series_number` columns to `book_catalog`

### 006_drop_old_books_table.sql
**Purpose:** Cleanup migration removing deprecated table

**Changes:**
- Drops old `books` table if it exists

### 007_add_families_rls_policy.sql
**Purpose:** Adds RLS policies for families table

**Changes:**
- Enables RLS on `families` table
- Adds policies for SELECT, INSERT, UPDATE operations

### 008_add_likes_count_function.sql
**Purpose:** Performance optimization for likes aggregation

**Changes:**
- Creates `get_likes_counts(uuid[])` PostgreSQL function for efficient aggregation
- Adds 3 indexes on `likes` table:
  - `idx_likes_book_catalog_id` - Book likes lookup
  - `idx_likes_user_id` - User likes lookup
  - `idx_likes_book_user` - Composite for user+book checks

**Performance Impact:** 63% improvement in likes queries (549ms → 198ms)

### 009_add_composite_indexes_for_books_queries.sql
**Purpose:** Optimizes common book query patterns

**Changes:**
- Adds 4 composite indexes:
  - `idx_family_books_family_status` - Family's books filtered by status
  - `idx_loans_status_borrower` - Active borrowed loans (partial index)
  - `idx_loans_status_owner` - Active loaned books (partial index)
  - `idx_family_books_updated_at` - Recently updated books sorting

**Performance Impact:** 50-70% improvement in filtered book queries

### 010_add_reviews_indexes.sql
**Purpose:** Optimizes review queries and prevents duplicates

**Changes:**
- Adds 3 indexes on `reviews` table:
  - `idx_reviews_book_created` - Composite for book reviews with date sorting
  - `idx_reviews_user_id` - User's reviews lookup
  - `idx_reviews_book_user` - Composite for duplicate review checks

**Performance Impact:** 60-80% improvement in review queries

### 011_add_missing_query_indexes.sql ⭐ NEW
**Purpose:** Comprehensive index coverage for all remaining query patterns

**Changes:**
- **book_catalog (4 indexes):**
  - `idx_book_catalog_genre` - Genre filtering (partial index)
  - `idx_book_catalog_age_level` - Age filtering (partial index)
  - `idx_book_catalog_series` - Series search (partial index)
  - `idx_book_catalog_genre_age` - Composite genre+age filter

- **families (1 index):**
  - `idx_families_name` - Name sorting

- **users (3 indexes):**
  - `idx_users_full_name` - Name sorting
  - `idx_users_email` - Email lookups (partial index)
  - `idx_users_family_name` - Composite family+name (covering index)

- **loans (3 indexes):**
  - `idx_loans_request_date` - Date sorting (DESC)
  - `idx_loans_borrower_date` - Composite borrower+date
  - `idx_loans_owner_date` - Composite owner+date

**Performance Impact:** 
- Filtered queries (genre/age): 70-90% faster
- Loan queries with sorting: 60-80% faster
- User/family queries: 50-70% faster

**Total Indexes Created:** 11 new indexes
**Safe to run multiple times:** Yes (uses `IF NOT EXISTS`)

---

## Summary

**Total Migrations:** 11
**Total Indexes in Database:** 37 (16 primary/unique + 21 query optimization)
**Performance Optimization Migrations:** 4 (migrations 008-011)

See `INDEX_OPTIMIZATION_SUMMARY.md` for comprehensive index documentation and performance analysis.
