-- Migration: Fix book deduplication to consider series and series_number
-- This prevents books from the same series being treated as duplicates

-- Drop the old function
DROP FUNCTION IF EXISTS find_book_in_catalog(VARCHAR, VARCHAR, VARCHAR);

-- Create updated function with series support
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
    -- First try to find by ISBN if provided (only if ISBN is valid)
    IF p_isbn IS NOT NULL AND p_isbn != '' AND p_isbn != '0' THEN
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

COMMENT ON FUNCTION find_book_in_catalog IS 'Helper function to search for existing books before creating duplicates. Now includes series and series_number for better matching.';
