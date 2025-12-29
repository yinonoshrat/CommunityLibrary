-- Migration: Fix detection_jobs_for_cleanup view to include manually deleted jobs
-- Purpose: Ensure images are deleted from storage even if the job was manually deleted by the user
-- Date: 2025-12-21

CREATE OR REPLACE VIEW detection_jobs_for_cleanup AS
SELECT *
FROM detection_jobs
WHERE (
    -- Case 1: Consumed jobs (retention 7 days)
    (NOT is_deleted AND consumed_at IS NOT NULL AND consumed_at < NOW() - INTERVAL '7 days')
    OR
    -- Case 2: Soft deleted jobs (retention 1 day)
    (NOT is_deleted AND deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '1 day')
    OR
    -- Case 3: Hard deleted but image not cleaned up (immediate cleanup)
    (is_deleted = true AND image_storage_path IS NOT NULL)
);

COMMENT ON VIEW detection_jobs_for_cleanup IS 'Jobs eligible for cleanup: consumed >7 days, soft-deleted >1 day, or hard-deleted with lingering image';
