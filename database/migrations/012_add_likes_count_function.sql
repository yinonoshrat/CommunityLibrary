-- Create a function to efficiently get likes counts for multiple books
-- This replaces fetching all likes rows and counting in the application
CREATE OR REPLACE FUNCTION get_likes_counts(catalog_ids uuid[])
RETURNS TABLE (
  book_catalog_id uuid,
  like_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.book_catalog_id,
    COUNT(*)::bigint as like_count
  FROM likes l
  WHERE l.book_catalog_id = ANY(catalog_ids)
  GROUP BY l.book_catalog_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add index on book_catalog_id if it doesn't exist for better performance
CREATE INDEX IF NOT EXISTS idx_likes_book_catalog_id ON likes(book_catalog_id);

-- Add index on user_id for faster user likes lookup
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);

-- Composite index for user + book lookups (used in single book detail page)
CREATE INDEX IF NOT EXISTS idx_likes_book_user ON likes(book_catalog_id, user_id);
