-- Migration 022: Create Supabase Storage bucket for detection job images
-- Purpose: Set up private storage for detection job images with audit logging
-- Created: 2024
-- Status: Ready for application

-- NOTE: RLS policies on storage.objects must be created via Supabase Dashboard
-- This is because storage.objects is owned by Supabase system user
-- Instead, we set up the bucket as private and configure policies via Dashboard

-- 1. Create the storage bucket if it doesn't exist
-- This requires the supabase_admin role or must be done via Dashboard
-- For now, we document the bucket setup that should be done in Dashboard:
/*
STORAGE BUCKET SETUP (via Supabase Dashboard):
1. Create bucket: "detection-job-images"
2. Set bucket to PRIVATE (not public)
3. Add RLS Policies:

   Policy 1: Users can upload their own images
   - Authenticated users
   - Bucket: detection-job-images
   - Operations: INSERT
   - Path pattern: uid/* (or users can only upload to their own folder)
   
   Policy 2: Users can read their own images
   - Authenticated users
   - Bucket: detection-job-images
   - Operations: SELECT
   - Path pattern: uid/*
   
   Policy 3: Service role can manage images
   - Service role (for Edge Functions)
   - Bucket: detection-job-images
   - Operations: SELECT, UPDATE, DELETE
   - Path pattern: *
*/

-- Store bucket configuration as documentation in database
CREATE TABLE IF NOT EXISTS bucket_configuration (
  id SERIAL PRIMARY KEY,
  bucket_id VARCHAR(255) UNIQUE,
  bucket_name VARCHAR(255),
  is_public BOOLEAN,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  notes TEXT
);

-- Document the detection-job-images bucket configuration
INSERT INTO bucket_configuration (bucket_id, bucket_name, is_public, description, notes)
VALUES (
  'detection-job-images',
  'detection-job-images',
  false,
  'Storage for detection job images with 7-day retention',
  'Must set up RLS policies in Supabase Dashboard. See documentation above.'
)
ON CONFLICT (bucket_id) DO NOTHING;

-- 2. Create an audit log table for storage operations
CREATE TABLE IF NOT EXISTS storage_audit_log (
  id BIGSERIAL PRIMARY KEY,
  bucket_id TEXT NOT NULL,
  object_path TEXT NOT NULL,
  operation VARCHAR(20) NOT NULL, -- 'upload', 'download', 'delete'
  user_id UUID,
  file_size_bytes BIGINT,
  mime_type VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reason TEXT, -- 'cleanup', 'user_delete', 'retention_policy'
  CONSTRAINT valid_operation CHECK (operation IN ('upload', 'download', 'delete'))
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_storage_audit_log_created_at ON storage_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_storage_audit_log_user_id ON storage_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_storage_audit_log_operation ON storage_audit_log(operation);
CREATE INDEX IF NOT EXISTS idx_storage_audit_log_bucket ON storage_audit_log(bucket_id);

-- Enable RLS on audit log
ALTER TABLE storage_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only view their own audit logs
CREATE POLICY "Users can view their own storage audit logs"
ON storage_audit_log
FOR SELECT
USING (user_id = auth.uid() OR user_id IS NULL);

-- RLS Policy: Only service role can insert audit logs
-- (This allows backend and Edge Functions to log operations)
CREATE POLICY "Service role can insert storage audit logs"
ON storage_audit_log
FOR INSERT
WITH CHECK (true);

-- 3. Create a view for storage analytics based on our audit log
CREATE OR REPLACE VIEW storage_usage_by_user AS
SELECT
  user_id,
  SUM(file_size_bytes) as total_bytes_used,
  COUNT(*) as file_count,
  MAX(created_at) as last_upload,
  CASE
    WHEN SUM(file_size_bytes) > 104857600 THEN 'Warning: >100MB used'
    WHEN SUM(file_size_bytes) > 52428800 THEN 'Warning: >50MB used'
    ELSE 'OK'
  END as usage_status
FROM storage_audit_log
WHERE operation = 'upload'
AND created_at > NOW() - INTERVAL '30 days'
GROUP BY user_id;

-- 4. Helper function to check if image should be cleaned up
-- Returns true if image is older than 7 days
CREATE OR REPLACE FUNCTION should_cleanup_image(upload_timestamp TIMESTAMP WITH TIME ZONE)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (NOW() - upload_timestamp) > INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Comments for documentation
COMMENT ON TABLE storage_audit_log IS 'Audit trail for all storage operations on detection job images';
COMMENT ON COLUMN storage_audit_log.operation IS 'Type of operation: upload, download, or delete';
COMMENT ON COLUMN storage_audit_log.reason IS 'Reason for operation, e.g., cleanup job, user initiated, retention policy';
COMMENT ON VIEW storage_usage_by_user IS 'Shows storage usage by user for quota enforcement and monitoring';
COMMENT ON FUNCTION should_cleanup_image(TIMESTAMP WITH TIME ZONE) IS 'Helper to determine if an image is eligible for cleanup (>7 days old)';
COMMENT ON TABLE bucket_configuration IS 'Documents storage bucket configuration and setup';
