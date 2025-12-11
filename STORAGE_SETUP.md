# Supabase Storage & RLS Configuration for Detection Job Images

## Overview
This document provides instructions for setting up Supabase Storage buckets and RLS policies for the image-based book detection system.

## Storage Architecture

### Bucket: `detection-job-images`
- **Purpose**: Store original and processed images for detection jobs
- **Size Limit**: 10MB per file
- **Retention**: Auto-delete after 30 days (if available in Supabase)
- **Access**: Private (users can only access their own images via signed URLs)

### Folder Structure
```
detection-job-images/
├── {userId}/
│   └── {jobId}/
│       ├── original.jpg        # Original image uploaded by user
│       └── thumbnail.jpg       # Compressed thumbnail (~500KB max) for quick display
```

## Setup Instructions

### 1. Create Storage Bucket via Supabase Dashboard

1. Go to **Supabase Dashboard** → **Storage**
2. Click **Create a new bucket**
3. Configure:
   - **Name**: `detection-job-images`
   - **Visibility**: Private
   - **File size limit**: 10 MB
4. Click **Create bucket**

### 2. Create Storage RLS Policies

These policies ensure users can only access their own images.

#### Policy 1: Users can upload to their own folder
```sql
CREATE POLICY "Users can upload to their own detection job folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    -- Check if user can upload: path starts with their UUID
    auth.uid()::text = (storage.foldername(name))[1]
    AND bucket_id = 'detection-job-images'
  );
```

#### Policy 2: Users can read their own images
```sql
CREATE POLICY "Users can download their own detection job images"
  ON storage.objects FOR SELECT
  USING (
    -- Check if user can read: path starts with their UUID
    auth.uid()::text = (storage.foldername(name))[1]
    AND bucket_id = 'detection-job-images'
  );
```

#### Policy 3: Users can delete their own images
```sql
CREATE POLICY "Users can delete their own detection job images"
  ON storage.objects FOR DELETE
  USING (
    -- Check if user can delete: path starts with their UUID
    auth.uid()::text = (storage.foldername(name))[1]
    AND bucket_id = 'detection-job-images'
  );
```

#### Policy 4: Service role can manage all images (for cleanup jobs)
```sql
CREATE POLICY "Service role can manage all detection job images"
  ON storage.objects FOR ALL
  USING (bucket_id = 'detection-job-images');
```

### Manual Setup via Supabase CLI
```bash
# Connect to your Supabase project
supabase link --project-ref <project-ref>

# Create the bucket
supabase storage create-bucket detection-job-images --private

# Or via SQL migration
supabase db push --dry-run  # See what would change
supabase db push             # Apply the changes
```

## Backend Integration

### 1. Save Image to Storage
```typescript
// In detectBooksFromImage controller (api/index.js or backend/server.js)

const { supabase } = await import('../db/adapter.js');

// Save original image
const originalFileName = `original.${imageExtension}`;
const originalPath = `${userId}/${jobId}/${originalFileName}`;

const { data: uploadData, error: uploadError } = await supabase
  .storage
  .from('detection-job-images')
  .upload(originalPath, imageBuffer, {
    cacheControl: '86400', // Cache for 24 hours
    contentType: mimeType,
    upsert: false // Don't overwrite if exists
  });

if (uploadError) {
  throw new Error(`Failed to upload image: ${uploadError.message}`);
}

// Create signed URL (valid for 7 days)
const { data: signedData, error: signedError } = await supabase
  .storage
  .from('detection-job-images')
  .createSignedUrl(originalPath, 7 * 24 * 60 * 60); // 7 days in seconds

if (signedError) {
  throw new Error(`Failed to create signed URL: ${signedError.message}`);
}

// Save thumbnail (base64, for quick display)
const thumbnailData = compressThumbnail(imageBuffer); // Max 500KB
const thumbnailPath = `${userId}/${jobId}/thumbnail.jpg`;

// Update database with image paths and URLs
await supabase
  .from('detection_jobs')
  .update({
    image_storage_path: originalPath,
    image_storage_url: signedData.signedUrl,
    image_base64_thumbnail: thumbnailData,
    image_mime_type: mimeType,
    image_size_bytes: imageBuffer.length,
    image_original_filename: originalFilename,
    image_uploaded_at: new Date().toISOString()
  })
  .eq('id', jobId);
```

### 2. Cleanup Old Images
Create a Supabase Edge Function or cron job to:
1. Find jobs older than 7 days (if consumed_at is set)
2. Delete images from storage
3. Clear image columns from database (or set `deleted_at`)

```typescript
// cleanup-detection-jobs-function.ts (Supabase Edge Function)

import { createClient } from '@supabase/supabase-js';

export default async (req: Request) => {
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

  // Find jobs to cleanup
  const { data: jobsToDelete, error: queryError } = await supabase
    .from('detection_jobs_for_cleanup')
    .select('id, user_id, image_storage_path')
    .limit(100);

  if (queryError) {
    console.error('Failed to fetch jobs for cleanup:', queryError);
    return new Response(JSON.stringify({ error: queryError.message }), { status: 500 });
  }

  let deletedCount = 0;

  for (const job of jobsToDelete || []) {
    try {
      // Delete image from storage
      if (job.image_storage_path) {
        await supabase
          .storage
          .from('detection-job-images')
          .remove([job.image_storage_path]);
      }

      // Soft-delete the job
      await supabase
        .from('detection_jobs')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          image_storage_path: null,
          image_storage_url: null,
          image_base64_thumbnail: null
        })
        .eq('id', job.id);

      deletedCount++;
    } catch (err) {
      console.error(`Failed to cleanup job ${job.id}:`, err);
    }
  }

  return new Response(
    JSON.stringify({ message: `Cleaned up ${deletedCount} jobs` }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
```

## Cron Job Configuration (Vercel/GitHub Actions)

### Option 1: Supabase Cron Extension
```sql
-- Create cron job to cleanup detection jobs daily at 2 AM
SELECT cron.schedule(
  'cleanup-detection-jobs',
  '0 2 * * *',  -- Daily at 2 AM
  'SELECT http_post(
    ''https://<YOUR_SUPABASE_FUNCTION_URL>/functions/v1/cleanup-detection-jobs'',
    jsonb_build_object(''action'', ''cleanup''),
    ''{"Authorization":"Bearer <SERVICE_ROLE_KEY>"}''::jsonb
  )'
);
```

### Option 2: GitHub Actions Workflow
```yaml
# .github/workflows/cleanup-detection-jobs.yml
name: Cleanup Detection Jobs

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Cleanup old detection jobs
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"action":"cleanup"}' \
            https://<YOUR_SUPABASE_FUNCTION_URL>/functions/v1/cleanup-detection-jobs
```

### Option 3: Vercel Cron Functions
```typescript
// api/cron/cleanup-detection-jobs.ts (Vercel)
export const config = {
  runtime: 'nodejs',
};

export default async (req: Request, res: Response) => {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Run cleanup logic here
  // ...

  return res.status(200).json({ message: 'Cleanup completed' });
};
```

## Frontend Integration

### Display Images from Storage
```typescript
// In BulkUpload.tsx
const imageUrl = job.image_storage_url || job.image_base64_thumbnail;

return (
  <Box
    component="img"
    src={imageUrl}
    alt="Uploaded image"
    sx={{ maxHeight: '300px', marginBottom: 2 }}
  />
);
```

### Resume Job from History
```typescript
// In DetectionJobHistory.tsx
const handleRetryJob = async (jobId: string) => {
  // Fetch the job with stored image
  const job = await fetchDetectionJob(jobId);
  
  // Display the image again
  setPreviewImage(job.image_storage_url || job.image_base64_thumbnail);
  
  // Allow user to retry detection or view previous results
};
```

## Monitoring

### Check Storage Usage
```sql
-- View total storage used for detection jobs
SELECT 
  SUM(size) as total_bytes,
  SUM(size) / (1024 * 1024) as total_mb,
  COUNT(*) as file_count
FROM storage.objects
WHERE bucket_id = 'detection-job-images';
```

### View Cleanup Activity
```sql
-- View deleted jobs
SELECT id, user_id, deleted_at, image_storage_path
FROM detection_jobs
WHERE is_deleted = true
ORDER BY deleted_at DESC
LIMIT 100;
```

## Troubleshooting

### "Permission denied" error when uploading
- Check if RLS policies are enabled
- Ensure user is authenticated (has valid JWT token)
- Verify path follows `{userId}/{jobId}/...` pattern

### Images not deleted after cleanup
- Check Supabase Edge Function logs
- Verify service role key has correct permissions
- Check if `is_deleted` flag is being set

### Signed URLs expiring too quickly
- Increase the expiration time (currently 7 days)
- Consider storing URLs in cache/Redis for faster access
- Pre-generate URLs and store them in database

## Performance Optimization

### Compress Thumbnails
```javascript
// Use sharp library for efficient compression
import sharp from 'sharp';

export async function createThumbnail(imageBuffer) {
  const thumbnail = await sharp(imageBuffer)
    .resize(400, 600, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: 60, progressive: true })
    .toBuffer();
  
  // Max 500KB
  if (thumbnail.length > 500 * 1024) {
    return await sharp(imageBuffer)
      .resize(300, 450, { fit: 'inside' })
      .jpeg({ quality: 40 })
      .toBuffer();
  }
  
  return thumbnail.toString('base64');
}
```

### CDN Caching
- Set `cacheControl: '86400'` (24 hours) for original images
- Images are automatically served through Supabase's CDN
- Signed URLs are cached based on `cacheControl` setting

## Security Considerations

1. **RLS Policies**: Users can only access their own images
2. **Signed URLs**: Images are not publicly accessible
3. **Expiration**: Signed URLs expire after 7 days
4. **Storage Deletion**: Images are automatically deleted after retention period
5. **No Direct Access**: Images cannot be accessed via public URLs

## References

- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Supabase RLS Policies](https://supabase.com/docs/guides/storage/security/overview)
- [Storage Objects Table](https://supabase.com/docs/guides/storage/quickstart#retrieve-file-list)
