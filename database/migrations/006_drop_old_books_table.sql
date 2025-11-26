-- Drop the old books table (replaced by book_catalog + family_books)
-- This should only be run after verifying that:
-- 1. All data has been migrated to the new structure
-- 2. The application is working correctly with books_view

DROP TABLE IF EXISTS books CASCADE;

COMMENT ON VIEW books_view IS 'Unified view of family_books joined with book_catalog - replaces old books table';
