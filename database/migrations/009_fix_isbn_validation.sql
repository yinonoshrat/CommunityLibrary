-- Migration: Fix ISBN validation to reject partial ISBNs
-- This prevents false matches on partial ISBN prefixes like "978"

-- Drop and recreate the function with better ISBN validation
DROP FUNCTION IF EXISTS find_book_in_catalog(VARCHAR, VARCHAR, VARCHAR, VARCHAR, INTEGER);

CREATE OR REPLACE FUNCTION find_book_in_catalog(
    p_title VARCHAR,
    p_author VARCHAR,
    p_isbn VARCHAR DEFAULT NULL,
    p_series VARCHAR DEFAULT NULL,
    p_series_number INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_book_id UUID;
BEGIN
    -- First try to find by ISBN if provided (only if ISBN is valid and has minimum length)
    -- Valid ISBNs are 10 or 13 digits. Reject partial ISBNs like "978"
    IF p_isbn IS NOT NULL 
       AND p_isbn != '' 
       AND p_isbn != '0' 
       AND LENGTH(p_isbn) >= 10 THEN
        SELECT id INTO v_book_id
        FROM book_catalog
        WHERE isbn = p_isbn
        LIMIT 1;
        
        IF v_book_id IS NOT NULL THEN
            RETURN v_book_id;
        END IF;
    END IF;
    
    -- Try exact title, author, series, and series_number match
    SELECT id INTO v_book_id
    FROM book_catalog
    WHERE LOWER(title) = LOWER(p_title)
      AND LOWER(COALESCE(author, '')) = LOWER(COALESCE(p_author, ''))
      AND LOWER(COALESCE(series, '')) = LOWER(COALESCE(p_series, ''))
      AND COALESCE(series_number, -1) = COALESCE(p_series_number, -1)
    LIMIT 1;
    
    IF v_book_id IS NOT NULL THEN
        RETURN v_book_id;
    END IF;
    
    -- No match found
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION find_book_in_catalog IS 'Helper function to search for existing books before creating duplicates. Validates ISBN length (min 10 chars) and includes series/series_number for better matching.';
