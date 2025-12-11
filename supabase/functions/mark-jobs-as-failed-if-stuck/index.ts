/**
 * Supabase Edge Function: Mark stale detection jobs as failed
 * 
 * Purpose:
 * - Find jobs stuck in 'processing' state for too long (>10 minutes)
 * - Mark them as 'failed' with error code 'TIMEOUT'
 * - Allow users to retry these jobs
 * 
 * This prevents jobs from being stuck in processing state forever
 * and ensures users get feedback about what went wrong
 * 
 * Schedule: Every 5 minutes
 * 
 * Usage:
 * curl -X POST \
 *   -H "Authorization: Bearer <service-role-key>" \
 *   https://<project>.functions.supabase.co/mark-jobs-as-failed-if-stuck
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
    console.log('[mark-jobs-as-failed-if-stuck] Checking for stale processing jobs...');

    // Calculate threshold: 10 minutes ago
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    // Find jobs that have been in 'processing' state for too long
    const { data: staleJobs, error: queryError } = await supabase
      .from('detection_jobs')
      .select('id, user_id, created_at, updated_at, stage, progress')
      .eq('status', 'processing')
      .lt('created_at', tenMinutesAgo)
      .limit(50);

    if (queryError) {
      console.error('[mark-jobs-as-failed-if-stuck] Query error:', queryError);
      return new Response(
        JSON.stringify({ error: 'Query failed', details: queryError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!staleJobs || staleJobs.length === 0) {
      console.log('[mark-jobs-as-failed-if-stuck] No stale jobs found');
      return new Response(
        JSON.stringify({ message: 'No stale jobs found', count: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[mark-jobs-as-failed-if-stuck] Found ${staleJobs.length} stale jobs`);

    let markedCount = 0;
    let errorCount = 0;

    // Mark each stale job as failed
    for (const job of staleJobs) {
      try {
        const processingDuration = Math.floor(
          (new Date().getTime() - new Date(job.created_at).getTime()) / 1000 / 60
        );

        console.log(
          `[mark-jobs-as-failed-if-stuck] Marking job ${job.id} as failed (stuck for ${processingDuration}m)`
        );

        const { error: updateError } = await supabase
          .from('detection_jobs')
          .update({
            status: 'failed',
            stage: 'failed_timeout',
            error_code: 'TIMEOUT',
            error: `Processing timeout: job was stuck in '${job.stage}' stage for ${processingDuration} minutes`,
            can_retry: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);

        if (updateError) {
          console.error(
            `[mark-jobs-as-failed-if-stuck] Failed to mark job ${job.id} as failed:`,
            updateError
          );
          errorCount++;
        } else {
          markedCount++;
        }
      } catch (err) {
        console.error(`[mark-jobs-as-failed-if-stuck] Exception processing job ${job.id}:`, err);
        errorCount++;
      }
    }

    console.log(
      `[mark-jobs-as-failed-if-stuck] Completed: ${markedCount} marked as failed, ${errorCount} errors`
    );

    return new Response(
      JSON.stringify({
        message: 'Timeout check completed',
        marked: markedCount,
        errors: errorCount,
        checked: staleJobs.length
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[mark-jobs-as-failed-if-stuck] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Timeout check failed', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
