-- Add series_number column to books table
ALTER TABLE books ADD COLUMN series_number INTEGER;

-- Add index for series queries
CREATE INDEX idx_books_series ON books(series) WHERE series IS NOT NULL;
