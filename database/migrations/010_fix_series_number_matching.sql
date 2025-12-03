-- Migration: Fix series_number matching to prevent matching different books in same series
-- Issue: Books with different series_numbers were being matched as duplicates

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
    -- Valid ISBNs are 10 or 13 digits. Reject partial ISBNs like "978" or "965"
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
    
    -- Try exact title + author match
    -- If series info is provided, it MUST match exactly (including series_number)
    -- This prevents matching different books in the same series
    IF p_series IS NOT NULL AND p_series != '' THEN
        -- Searching for a book in a series
        SELECT id INTO v_book_id
        FROM book_catalog
        WHERE LOWER(title) = LOWER(p_title)
          AND LOWER(COALESCE(author, '')) = LOWER(COALESCE(p_author, ''))
          AND LOWER(series) = LOWER(p_series)
          AND (
            -- Both have series_number and they match
            (series_number IS NOT NULL AND p_series_number IS NOT NULL AND series_number = p_series_number)
            -- OR both don't have series_number
            OR (series_number IS NULL AND p_series_number IS NULL)
          )
        LIMIT 1;
    ELSE
        -- Not searching for a series book, match by title + author only
        SELECT id INTO v_book_id
        FROM book_catalog
        WHERE LOWER(title) = LOWER(p_title)
          AND LOWER(COALESCE(author, '')) = LOWER(COALESCE(p_author, ''))
          AND (series IS NULL OR series = '')
        LIMIT 1;
    END IF;
    
    IF v_book_id IS NOT NULL THEN
        RETURN v_book_id;
    END IF;
    
    -- No match found
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION find_book_in_catalog IS 'Helper function to search for existing books before creating duplicates. Requires exact series_number match when series is provided to prevent matching different books in the same series.';
