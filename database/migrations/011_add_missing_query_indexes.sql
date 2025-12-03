-- Migration: Add missing indexes for common query patterns
-- This migration adds indexes for frequently used filters, ORDER BY clauses, and search patterns

-- ============================================================================
-- book_catalog table indexes
-- ============================================================================

-- Index for genre filtering (WHERE genre = ?)
-- Used in: books.controller.js catalog search, adapter.js filters
CREATE INDEX IF NOT EXISTS idx_book_catalog_genre 
ON book_catalog(genre) 
WHERE genre IS NOT NULL;

-- Index for age_level filtering (WHERE age_level = ?)
-- Used in: books.controller.js catalog search with age filters
CREATE INDEX IF NOT EXISTS idx_book_catalog_age_level 
ON book_catalog(age_level) 
WHERE age_level IS NOT NULL;

-- Index for series searches (WHERE series ILIKE '%term%')
-- Used in: adapter.js books.getAll with series filter
CREATE INDEX IF NOT EXISTS idx_book_catalog_series 
ON book_catalog(series) 
WHERE series IS NOT NULL;

-- Composite index for common combined queries (genre + age_level)
-- Speeds up queries that filter by both genre and age range
CREATE INDEX IF NOT EXISTS idx_book_catalog_genre_age 
ON book_catalog(genre, age_level) 
WHERE genre IS NOT NULL AND age_level IS NOT NULL;

-- ============================================================================
-- families table indexes
-- ============================================================================

-- Index for name ordering (ORDER BY name)
-- Used in: adapter.js families.getAll
CREATE INDEX IF NOT EXISTS idx_families_name 
ON families(name);

-- ============================================================================
-- users table indexes
-- ============================================================================

-- Index for full_name ordering (ORDER BY full_name)
-- Used in: adapter.js users.getByFamilyId, auth.controller.js user selection
CREATE INDEX IF NOT EXISTS idx_users_full_name 
ON users(full_name);

-- Index for email lookups (WHERE email = ?)
-- Used in: auth.controller.js user selection by email
CREATE INDEX IF NOT EXISTS idx_users_email 
ON users(email) 
WHERE email IS NOT NULL;

-- Composite index for family + name ordering
-- Optimizes queries that filter by family and sort by name
CREATE INDEX IF NOT EXISTS idx_users_family_name 
ON users(family_id, full_name);

-- ============================================================================
-- loans table indexes
-- ============================================================================

-- Index for request_date ordering (ORDER BY request_date DESC)
-- Used in: adapter.js loans.getAll default sort
CREATE INDEX IF NOT EXISTS idx_loans_request_date 
ON loans(request_date DESC);

-- Composite indexes for filtered + sorted queries
-- Used in: adapter.js loans.getAll with borrower/owner filters + date sort
CREATE INDEX IF NOT EXISTS idx_loans_borrower_date 
ON loans(borrower_family_id, request_date DESC);

CREATE INDEX IF NOT EXISTS idx_loans_owner_date 
ON loans(owner_family_id, request_date DESC);

-- ============================================================================
-- Summary of new indexes
-- ============================================================================
-- book_catalog: 4 indexes (genre, age_level, series, genre+age_level composite)
-- families: 1 index (name)
-- users: 3 indexes (full_name, email, family_id+full_name composite)
-- loans: 3 indexes (request_date, borrower+date composite, owner+date composite)
-- Total: 11 new indexes
