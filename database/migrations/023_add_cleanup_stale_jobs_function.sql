-- Migration: Add function to cleanup stale detection jobs
-- Purpose: Automatically mark jobs as failed if they have been stuck in 'processing' for too long
-- Date: 2025-12-13

CREATE OR REPLACE FUNCTION cleanup_stale_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE detection_jobs
  SET 
    status = 'failed',
    stage = 'failed_timeout',
    error_code = 'TIMEOUT',
    can_retry = true,
    updated_at = NOW()
  WHERE 
    status = 'processing' 
    AND updated_at < (NOW() - INTERVAL '10 minutes');
END;
$$;

-- Grant execute permission to authenticated users so they can trigger cleanup
GRANT EXECUTE ON FUNCTION cleanup_stale_jobs TO authenticated;
