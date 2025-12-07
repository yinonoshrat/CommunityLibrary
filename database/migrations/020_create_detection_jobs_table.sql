-- Migration: Create detection_jobs table for async book detection
-- Purpose: Track async jobs for book detection from images (Supabase Edge Function)
-- Date: 2025-01-07

-- Create detection_jobs table
CREATE TABLE IF NOT EXISTS detection_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
  image_data TEXT, -- Base64 encoded image for edge function
  result JSONB, -- Detected books array: { books: [], count: number }
  error TEXT,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_detection_jobs_user_id ON detection_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_detection_jobs_status ON detection_jobs(status);
CREATE INDEX IF NOT EXISTS idx_detection_jobs_created_at ON detection_jobs(created_at DESC);

-- Enable RLS
ALTER TABLE detection_jobs ENABLE ROW LEVEL SECURITY;

-- Users can only access their own jobs
CREATE POLICY "Users can view their own detection jobs"
  ON detection_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own detection jobs"
  ON detection_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Edge function updates jobs using service role (bypasses RLS)
CREATE POLICY "Service role can update detection jobs"
  ON detection_jobs FOR UPDATE
  USING (true); -- Service role key bypasses RLS anyway, but explicit policy is clearer

-- Add comment
COMMENT ON TABLE detection_jobs IS 'Tracks async book detection jobs from image uploads';
COMMENT ON COLUMN detection_jobs.image_data IS 'Base64 encoded image, removed after processing';
COMMENT ON COLUMN detection_jobs.result IS 'JSON result: {books: [], count: number}';
COMMENT ON COLUMN detection_jobs.progress IS 'Progress percentage (0-100)';
