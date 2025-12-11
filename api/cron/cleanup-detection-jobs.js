/**
 * Vercel Serverless Function: Cleanup Detection Jobs
 * 
 * Purpose: Delete old detection job images (>7 days) and soft-delete jobs
 * Trigger: Scheduled via vercel.json cron (daily at 2 AM UTC)
 * Method: GET /api/cron/cleanup-detection-jobs
 * 
 * Authentication: Vercel CRON_SECRET header
 */

const { createClient } = require('@supabase/supabase-js');

// Verify cron secret
function verifyCron(req) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  const token = authHeader.substring(7);
  return token === cronSecret;
}

module.exports = async (req, res) => {
  const startTime = Date.now();
  
  // Only accept GET requests from Vercel cron
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Verify cron authentication
  if (!verifyCron(req)) {
    console.warn('[cleanup-detection-jobs] Unauthorized cron request');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('[cleanup-detection-jobs] Starting cleanup process...');

    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Find images older than 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: jobsToDelete, error: queryError } = await supabase
      .from('detection_jobs')
      .select('id, user_id, image_storage_path, image_storage_url')
      .lt('image_uploaded_at', sevenDaysAgo)
      .eq('is_deleted', false)
      .eq('status', 'completed')
      .limit(100);

    if (queryError) {
      console.error('[cleanup-detection-jobs] Query error:', queryError);
      return res.status(500).json({ 
        error: 'Query failed', 
        details: queryError.message 
      });
    }

    if (!jobsToDelete || jobsToDelete.length === 0) {
      console.log('[cleanup-detection-jobs] No jobs eligible for cleanup');
      return res.status(200).json({
        message: 'No jobs to cleanup',
        deleted: 0,
        processed: 0,
        duration_ms: Date.now() - startTime
      });
    }

    console.log(`[cleanup-detection-jobs] Found ${jobsToDelete.length} jobs to cleanup`);

    let deleted = 0;
    let errors = [];

    // Delete images and soft-delete jobs
    for (const job of jobsToDelete) {
      try {
        // Delete from storage if path exists
        if (job.image_storage_path) {
          const { error: storageError } = await supabase.storage
            .from('detection-job-images')
            .remove([job.image_storage_path]);

          if (storageError && storageError.message !== 'Not found') {
            console.warn(`[cleanup-detection-jobs] Storage delete failed: ${storageError.message}`);
            errors.push(`Storage delete failed for ${job.id}`);
          } else {
            deleted++;
          }
        }

        // Soft-delete the job
        const { error: updateError } = await supabase
          .from('detection_jobs')
          .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            image_storage_path: null,
            image_storage_url: null,
            image_base64_thumbnail: null
          })
          .eq('id', job.id);

        if (updateError) {
          console.error(`[cleanup-detection-jobs] Failed to delete job ${job.id}:`, updateError);
          errors.push(`Job delete failed for ${job.id}`);
        }

        // Log the cleanup action
        await supabase
          .from('storage_audit_log')
          .insert({
            bucket_id: 'detection-job-images',
            object_path: job.image_storage_path || 'unknown',
            operation: 'delete',
            user_id: job.user_id,
            reason: 'retention_policy_cleanup'
          });

      } catch (err) {
        console.error(`[cleanup-detection-jobs] Error processing job ${job.id}:`, err.message);
        errors.push(`Exception for ${job.id}: ${err.message}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[cleanup-detection-jobs] Complete: ${deleted} deleted in ${duration}ms`);

    return res.status(200).json({
      message: 'Cleanup completed',
      deleted,
      errors: errors.length > 0 ? errors : undefined,
      processed: jobsToDelete.length,
      duration_ms: duration
    });

  } catch (error) {
    console.error('[cleanup-detection-jobs] Fatal error:', error);
    return res.status(500).json({
      error: 'Cleanup failed',
      details: error.message,
      duration_ms: Date.now() - startTime
    });
  }
};
