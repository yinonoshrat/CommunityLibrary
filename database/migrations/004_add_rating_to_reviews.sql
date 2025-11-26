-- Add rating column to reviews table
-- This migration adds a rating field (1-5 stars) to book reviews

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating >= 1 AND rating <= 5);

-- Set default rating for existing reviews (if any)
UPDATE reviews SET rating = 5 WHERE rating IS NULL;

-- Make rating NOT NULL after setting defaults
ALTER TABLE reviews ALTER COLUMN rating SET NOT NULL;

-- Add index for efficient rating queries
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);

-- Update the reviews table reference from books to book_catalog
-- First, check if book_catalog_id column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reviews' AND column_name = 'book_catalog_id'
    ) THEN
        -- Add book_catalog_id column
        ALTER TABLE reviews ADD COLUMN book_catalog_id UUID REFERENCES book_catalog(id) ON DELETE CASCADE;
        
        -- Migrate data from book_id to book_catalog_id if book_id exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'reviews' AND column_name = 'book_id'
        ) THEN
            -- Update book_catalog_id based on family_books relationship
            UPDATE reviews r
            SET book_catalog_id = fb.book_catalog_id
            FROM family_books fb
            WHERE r.book_id = fb.id;
            
            -- Drop the old book_id column
            ALTER TABLE reviews DROP COLUMN book_id;
        END IF;
        
        -- Make book_catalog_id NOT NULL
        ALTER TABLE reviews ALTER COLUMN book_catalog_id SET NOT NULL;
        
        -- Update unique constraint
        ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_book_id_user_id_key;
        ALTER TABLE reviews ADD CONSTRAINT reviews_book_catalog_id_user_id_key UNIQUE (book_catalog_id, user_id);
    END IF;
END $$;
