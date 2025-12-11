-- Migration: Enhance detection_jobs table for image persistence and error handling
-- Purpose: Add columns for image storage, error tracking, stage progress, and auto-cleanup
-- Date: 2025-12-11

-- Add new columns for image storage and metadata
ALTER TABLE detection_jobs
ADD COLUMN IF NOT EXISTS image_original_filename TEXT,
ADD COLUMN IF NOT EXISTS image_base64_thumbnail TEXT, -- Max ~500KB, for quick display
ADD COLUMN IF NOT EXISTS image_storage_path TEXT, -- Path in Supabase Storage bucket
ADD COLUMN IF NOT EXISTS image_storage_url TEXT, -- Signed URL to original image (1 week expiry)
ADD COLUMN IF NOT EXISTS image_mime_type TEXT DEFAULT 'image/jpeg',
ADD COLUMN IF NOT EXISTS image_size_bytes INTEGER,
ADD COLUMN IF NOT EXISTS image_uploaded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ai_model_used TEXT DEFAULT 'gemini-2.5-flash', -- Which model processed this job
ADD COLUMN IF NOT EXISTS error_code TEXT, -- Specific error code: INVALID_IMAGE, OCR_FAILED, AI_FAILED, TIMEOUT, etc.
ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'pending' CHECK (stage IN (
  'pending',           -- Initial state, waiting to process
  'uploading',         -- Image being uploaded to storage
  'extracting_text',   -- Running OCR via Google Cloud Vision
  'analyzing_books',   -- Running AI inference on OCR data
  'completed',         -- Successfully processed
  'failed_timeout',    -- Processing took too long (>10 min)
  'failed_invalid',    -- Invalid image format
  'failed_ocr',        -- OCR extraction failed
  'failed_ai',         -- AI inference failed
  'failed_other'       -- Other unrecoverable error
)),
ADD COLUMN IF NOT EXISTS can_retry BOOLEAN DEFAULT true, -- Whether user should retry (false for invalid image)
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS detected_books_confidence FLOAT, -- Average confidence of detected books (0-1)
ADD COLUMN IF NOT EXISTS image_analysis_metadata JSONB, -- OCR blocks, detected regions, timing info
ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ, -- When user completed action (added books to catalog)
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ, -- Soft delete timestamp
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false; -- For efficient filtering

-- Update status CHECK constraint to include new status values
ALTER TABLE detection_jobs
DROP CONSTRAINT IF EXISTS detection_jobs_status_check;

ALTER TABLE detection_jobs
ADD CONSTRAINT detection_jobs_status_check 
CHECK (status IN ('processing', 'completed', 'failed'));

-- Add new indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_detection_jobs_stage ON detection_jobs(stage);
CREATE INDEX IF NOT EXISTS idx_detection_jobs_image_uploaded_at ON detection_jobs(image_uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_detection_jobs_consumed_at ON detection_jobs(consumed_at DESC);
CREATE INDEX IF NOT EXISTS idx_detection_jobs_error_code ON detection_jobs(error_code);
CREATE INDEX IF NOT EXISTS idx_detection_jobs_is_deleted ON detection_jobs(is_deleted);
CREATE INDEX IF NOT EXISTS idx_detection_jobs_ai_model ON detection_jobs(ai_model_used);
CREATE INDEX IF NOT EXISTS idx_detection_jobs_user_status_stage ON detection_jobs(user_id, status, stage); -- Compound index for UI queries

-- Update RLS policy to filter soft-deleted records
-- (Old policies remain, this is additional for soft delete)
CREATE POLICY "Users cannot view deleted detection jobs"
  ON detection_jobs FOR SELECT
  USING (auth.uid() = user_id AND NOT is_deleted);

-- Service role policy update for soft delete compatibility
CREATE POLICY "Service role can update deleted status"
  ON detection_jobs FOR UPDATE
  USING (true);

-- Add helpful comments
COMMENT ON COLUMN detection_jobs.image_original_filename IS 'Original filename uploaded by user (for display)';
COMMENT ON COLUMN detection_jobs.image_base64_thumbnail IS 'Base64 thumbnail (~500KB max), removed after 7 days';
COMMENT ON COLUMN detection_jobs.image_storage_path IS 'Path in Supabase Storage: detection-job-images/{userId}/{jobId}/original.{ext}';
COMMENT ON COLUMN detection_jobs.image_storage_url IS 'Signed URL to original image in Storage (expires in 7 days)';
COMMENT ON COLUMN detection_jobs.ai_model_used IS 'Which model processed: gemini-2.5-flash, gpt-4o-mini, etc.';
COMMENT ON COLUMN detection_jobs.error_code IS 'Machine-readable error code for retry logic (INVALID_IMAGE, OCR_FAILED, AI_FAILED, TIMEOUT, AI_DEGRADED)';
COMMENT ON COLUMN detection_jobs.stage IS 'Current processing stage for granular progress reporting';
COMMENT ON COLUMN detection_jobs.can_retry IS 'Whether the user should retry (false for invalid images, true for transient failures)';
COMMENT ON COLUMN detection_jobs.detected_books_confidence IS 'Average confidence score (0-1) of all books detected in this image';
COMMENT ON COLUMN detection_jobs.image_analysis_metadata IS 'JSON: {ocr_blocks: [], total_text_confidence: float, processing_time_ms: number}';
COMMENT ON COLUMN detection_jobs.consumed_at IS 'Set when user adds books to catalog, triggers 7-day auto-delete countdown';
COMMENT ON COLUMN detection_jobs.deleted_at IS 'Set when user explicitly deletes, triggers 1-day auto-delete countdown';
COMMENT ON COLUMN detection_jobs.is_deleted IS 'Soft delete flag for efficient filtering and recovery';

-- Create cleaner view for active jobs (not deleted, not too old)
CREATE OR REPLACE VIEW detection_jobs_active AS
SELECT *
FROM detection_jobs
WHERE NOT is_deleted
  AND created_at > NOW() - INTERVAL '7 days';

COMMENT ON VIEW detection_jobs_active IS 'Active detection jobs (not deleted, created within 7 days)';

-- Create view for jobs awaiting cleanup (consumed but not yet deleted)
CREATE OR REPLACE VIEW detection_jobs_for_cleanup AS
SELECT *
FROM detection_jobs
WHERE NOT is_deleted
  AND consumed_at IS NOT NULL
  AND consumed_at < NOW() - INTERVAL '7 days'
UNION ALL
SELECT *
FROM detection_jobs
WHERE NOT is_deleted
  AND deleted_at IS NOT NULL
  AND deleted_at < NOW() - INTERVAL '1 day';

COMMENT ON VIEW detection_jobs_for_cleanup IS 'Jobs eligible for cleanup (consumed >7 days ago OR deleted >1 day ago)';
