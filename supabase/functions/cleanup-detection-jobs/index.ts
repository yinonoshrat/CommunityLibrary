/**
 * Supabase Edge Function: Cleanup old detection jobs
 * 
 * Purpose:
 * - Delete images from storage after retention period
 * - Soft-delete jobs from database
 * - Free up storage space
 * 
 * Retention Policy:
 * - Consumed jobs: 7 days after consumed_at
 * - Deleted jobs: 1 day after deleted_at
 * - Failed jobs: Keep indefinitely for debugging (can be manually deleted)
 * 
 * Schedule: Daily at 2 AM UTC
 * 
 * Usage:
 * curl -X POST \
 *   -H "Authorization: Bearer <service-role-key>" \
 *   https://<project>.functions.supabase.co/cleanup-detection-jobs
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export default async (req: Request) => {
  // Verify authentication
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  if (!token || token !== Deno.env.get('SERVICE_ROLE_KEY')) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SERVICE_ROLE_KEY') || ''
  );

  try {
    console.log('[cleanup-detection-jobs] Starting cleanup process...');

    // Find jobs eligible for cleanup
    const { data: jobsToDelete, error: queryError } = await supabase
      .from('detection_jobs_for_cleanup')
      .select('id, user_id, image_storage_path, deleted_at, consumed_at')
      .limit(100);

    if (queryError) {
      console.error('[cleanup-detection-jobs] Query error:', queryError);
      return new Response(
        JSON.stringify({ error: 'Query failed', details: queryError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!jobsToDelete || jobsToDelete.length === 0) {
      console.log('[cleanup-detection-jobs] No jobs to cleanup');
      return new Response(
        JSON.stringify({ message: 'No jobs to cleanup', count: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[cleanup-detection-jobs] Found ${jobsToDelete.length} jobs to cleanup`);

    let deletedCount = 0;
    let errorCount = 0;

    // Process each job
    for (const job of jobsToDelete) {
      try {
        // Delete image from storage if path exists
        if (job.image_storage_path) {
          const { error: storageError } = await supabase
            .storage
            .from('detection-job-images')
            .remove([job.image_storage_path]);

          if (storageError) {
            console.warn(
              `[cleanup-detection-jobs] Failed to delete storage file ${job.image_storage_path}:`,
              storageError
            );
            // Continue with database cleanup even if storage delete fails
          } else {
            console.log(`[cleanup-detection-jobs] Deleted storage file: ${job.image_storage_path}`);
          }
        }

        // Soft-delete the job in database
        const { error: dbError } = await supabase
          .from('detection_jobs')
          .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            image_storage_path: null,
            image_storage_url: null,
            image_base64_thumbnail: null
          })
          .eq('id', job.id);

        if (dbError) {
          console.error(
            `[cleanup-detection-jobs] Failed to delete job ${job.id}:`,
            dbError
          );
          errorCount++;
        } else {
          console.log(`[cleanup-detection-jobs] Cleaned up job: ${job.id}`);
          deletedCount++;
        }
      } catch (err) {
        console.error(`[cleanup-detection-jobs] Exception processing job ${job.id}:`, err);
        errorCount++;
      }
    }

    console.log(
      `[cleanup-detection-jobs] Cleanup complete: ${deletedCount} deleted, ${errorCount} errors`
    );

    return new Response(
      JSON.stringify({
        message: 'Cleanup completed',
        deleted: deletedCount,
        errors: errorCount,
        processed: jobsToDelete.length
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[cleanup-detection-jobs] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Cleanup failed', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
