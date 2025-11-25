-- Migration: Shared Books Catalog
-- This migration restructures the database to support multiple families owning the same book
-- while maintaining separate reviews, ratings, and ownership records.

-- Step 1: Create new global books catalog table
CREATE TABLE book_catalog (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    title_hebrew VARCHAR(500),
    author VARCHAR(255),
    author_hebrew VARCHAR(255),
    isbn VARCHAR(20) UNIQUE, -- Unique constraint on ISBN to prevent duplicates
    publisher VARCHAR(255),
    year_published INTEGER,
    genre VARCHAR(100),
    age_level VARCHAR(50),
    pages INTEGER,
    summary TEXT,
    cover_image_url TEXT,
    series VARCHAR(255),
    series_number INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Create family_books join table (which family owns which book)
CREATE TABLE family_books (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID REFERENCES families(id) ON DELETE CASCADE NOT NULL,
    book_catalog_id UUID REFERENCES book_catalog(id) ON DELETE CASCADE NOT NULL,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'on_loan', 'unavailable')),
    condition VARCHAR(50), -- 'new', 'good', 'fair', 'poor'
    notes TEXT, -- Private notes for the family
    acquired_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(family_id, book_catalog_id) -- A family can only own one copy of each book
);

-- Step 3: Migrate existing books to new structure
INSERT INTO book_catalog (title, author, isbn, publisher, year_published, genre, age_level, pages, summary, cover_image_url, series, created_at)
SELECT DISTINCT ON (COALESCE(isbn, title || author))
    title,
    author,
    isbn,
    publisher,
    publish_year,
    genre,
    age_range,
    pages,
    description,
    cover_image_url,
    series,
    MIN(created_at) as created_at
FROM books
WHERE isbn IS NOT NULL AND isbn != ''
GROUP BY title, author, isbn, publisher, publish_year, genre, age_range, pages, description, cover_image_url, series

UNION

SELECT DISTINCT ON (title || author)
    title,
    author,
    NULL as isbn,
    publisher,
    publish_year,
    genre,
    age_range,
    pages,
    description,
    cover_image_url,
    series,
    MIN(created_at) as created_at
FROM books
WHERE isbn IS NULL OR isbn = ''
GROUP BY title, author, publisher, publish_year, genre, age_range, pages, description, cover_image_url, series;

-- Step 4: Create family_books records from existing books
INSERT INTO family_books (family_id, book_catalog_id, status, created_at)
SELECT 
    b.family_id,
    bc.id,
    CASE 
        WHEN b.status = 'borrowed' THEN 'on_loan'
        ELSE b.status
    END,
    b.created_at
FROM books b
JOIN book_catalog bc ON (
    (b.isbn IS NOT NULL AND b.isbn != '' AND bc.isbn = b.isbn)
    OR (
        (b.isbn IS NULL OR b.isbn = '') 
        AND bc.title = b.title 
        AND bc.author = b.author
        AND bc.isbn IS NULL
    )
);

-- Step 5: Update reviews table to reference book_catalog instead of books
ALTER TABLE reviews DROP CONSTRAINT reviews_book_id_fkey;
ALTER TABLE reviews RENAME COLUMN book_id TO book_catalog_id;
ALTER TABLE reviews ADD CONSTRAINT reviews_book_catalog_id_fkey 
    FOREIGN KEY (book_catalog_id) REFERENCES book_catalog(id) ON DELETE CASCADE;

-- Update reviews to point to catalog
UPDATE reviews r
SET book_catalog_id = bc.id
FROM books b
JOIN book_catalog bc ON (
    (b.isbn IS NOT NULL AND b.isbn != '' AND bc.isbn = b.isbn)
    OR (
        (b.isbn IS NULL OR b.isbn = '') 
        AND bc.title = b.title 
        AND bc.author = b.author
        AND bc.isbn IS NULL
    )
)
WHERE r.book_catalog_id = b.id;

-- Step 6: Update likes table to reference book_catalog instead of books
ALTER TABLE likes DROP CONSTRAINT likes_book_id_fkey;
ALTER TABLE likes RENAME COLUMN book_id TO book_catalog_id;
ALTER TABLE likes ADD CONSTRAINT likes_book_catalog_id_fkey 
    FOREIGN KEY (book_catalog_id) REFERENCES book_catalog(id) ON DELETE CASCADE;

-- Update likes to point to catalog
UPDATE likes l
SET book_catalog_id = bc.id
FROM books b
JOIN book_catalog bc ON (
    (b.isbn IS NOT NULL AND b.isbn != '' AND bc.isbn = b.isbn)
    OR (
        (b.isbn IS NULL OR b.isbn = '') 
        AND bc.title = b.title 
        AND bc.author = b.author
        AND bc.isbn IS NULL
    )
)
WHERE l.book_catalog_id = b.id;

-- Step 7: Update loans table to reference family_books
ALTER TABLE loans RENAME COLUMN book_id TO family_book_id;
ALTER TABLE loans DROP CONSTRAINT loans_book_id_fkey;
ALTER TABLE loans ADD CONSTRAINT loans_family_book_id_fkey 
    FOREIGN KEY (family_book_id) REFERENCES family_books(id) ON DELETE CASCADE;

-- Update loans to point to family_books
UPDATE loans lo
SET family_book_id = fb.id
FROM books b
JOIN family_books fb ON fb.family_id = b.family_id
JOIN book_catalog bc ON fb.book_catalog_id = bc.id
WHERE lo.family_book_id = b.id
AND (
    (b.isbn IS NOT NULL AND b.isbn != '' AND bc.isbn = b.isbn)
    OR (
        (b.isbn IS NULL OR b.isbn = '') 
        AND bc.title = b.title 
        AND bc.author = b.author
        AND bc.isbn IS NULL
    )
);

-- Step 8: Create indexes for performance
CREATE INDEX idx_book_catalog_isbn ON book_catalog(isbn) WHERE isbn IS NOT NULL;
CREATE INDEX idx_book_catalog_title ON book_catalog(title);
CREATE INDEX idx_book_catalog_author ON book_catalog(author);
CREATE INDEX idx_family_books_family_id ON family_books(family_id);
CREATE INDEX idx_family_books_book_catalog_id ON family_books(book_catalog_id);
CREATE INDEX idx_family_books_status ON family_books(status);
CREATE INDEX idx_reviews_book_catalog_id ON reviews(book_catalog_id);
CREATE INDEX idx_likes_book_catalog_id ON likes(book_catalog_id);
CREATE INDEX idx_loans_family_book_id ON loans(family_book_id);

-- Step 9: Enable RLS on new tables
ALTER TABLE book_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_books ENABLE ROW LEVEL SECURITY;

-- RLS Policies for book_catalog (everyone can read)
CREATE POLICY "Anyone can view book catalog" ON book_catalog FOR SELECT USING (true);

-- RLS Policies for family_books
CREATE POLICY "Users can view all family books" ON family_books FOR SELECT USING (true);

CREATE POLICY "Family members can manage their books" ON family_books FOR ALL 
    USING (family_id IN (SELECT family_id FROM users WHERE id = auth.uid()));

-- Step 10: Update existing RLS policies for reviews and likes
DROP POLICY IF EXISTS "Users can manage own reviews" ON reviews;
CREATE POLICY "Users can manage own reviews" ON reviews FOR ALL 
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own likes" ON likes;
CREATE POLICY "Users can manage own likes" ON likes FOR ALL 
    USING (user_id = auth.uid());

-- Step 11: Create triggers for updated_at
CREATE TRIGGER update_book_catalog_updated_at BEFORE UPDATE ON book_catalog
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_family_books_updated_at BEFORE UPDATE ON family_books
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 12: Drop old books table (after verifying migration)
-- IMPORTANT: Uncomment only after verifying the migration was successful
-- DROP TABLE books CASCADE;

-- Step 13: Create helper function to search for existing books
CREATE OR REPLACE FUNCTION find_book_in_catalog(
    p_title VARCHAR,
    p_author VARCHAR,
    p_isbn VARCHAR DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_book_id UUID;
BEGIN
    -- First try to find by ISBN if provided
    IF p_isbn IS NOT NULL AND p_isbn != '' THEN
        SELECT id INTO v_book_id
        FROM book_catalog
        WHERE isbn = p_isbn
        LIMIT 1;
        
        IF v_book_id IS NOT NULL THEN
            RETURN v_book_id;
        END IF;
    END IF;
    
    -- Try exact title and author match
    SELECT id INTO v_book_id
    FROM book_catalog
    WHERE LOWER(title) = LOWER(p_title)
      AND LOWER(author) = LOWER(p_author)
    LIMIT 1;
    
    IF v_book_id IS NOT NULL THEN
        RETURN v_book_id;
    END IF;
    
    -- Try fuzzy match on title (using similarity if pg_trgm is available)
    -- For now, just use LIKE
    SELECT id INTO v_book_id
    FROM book_catalog
    WHERE LOWER(title) LIKE '%' || LOWER(p_title) || '%'
      AND LOWER(author) = LOWER(p_author)
    LIMIT 1;
    
    RETURN v_book_id;
END;
$$ LANGUAGE plpgsql;

-- Step 14: Create view for backward compatibility
CREATE OR REPLACE VIEW books_view AS
SELECT 
    fb.id,
    fb.family_id,
    bc.title,
    bc.title_hebrew,
    bc.author,
    bc.author_hebrew,
    bc.isbn,
    bc.publisher,
    bc.year_published as publish_year,
    bc.genre,
    bc.age_level as age_range,
    bc.pages,
    bc.summary as description,
    bc.cover_image_url,
    bc.series,
    bc.series_number,
    fb.status,
    fb.condition,
    fb.notes,
    fb.created_at,
    fb.updated_at,
    bc.id as book_catalog_id
FROM family_books fb
JOIN book_catalog bc ON fb.book_catalog_id = bc.id;

COMMENT ON TABLE book_catalog IS 'Global catalog of unique books (deduplicated by ISBN)';
COMMENT ON TABLE family_books IS 'Junction table showing which families own which books from the catalog';
COMMENT ON COLUMN book_catalog.isbn IS 'Unique ISBN identifier - used to prevent duplicate books';
COMMENT ON FUNCTION find_book_in_catalog IS 'Helper function to search for existing books before creating duplicates';
