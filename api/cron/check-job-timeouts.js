/**
 * Vercel Serverless Function: Check for Timeout Detection Jobs
 * 
 * Purpose: Find jobs stuck in processing >10 minutes and mark as failed
 * Trigger: Scheduled via vercel.json cron (every 5 minutes)
 * Method: GET /api/cron/check-job-timeouts
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
    console.warn('[check-job-timeouts] Unauthorized cron request');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('[check-job-timeouts] Checking for stale processing jobs...');

    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Calculate threshold: 10 minutes ago
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    // Find jobs stuck in processing for >10 minutes
    const { data: staleJobs, error: queryError } = await supabase
      .from('detection_jobs')
      .select('id, user_id, created_at, updated_at, stage, progress')
      .eq('status', 'processing')
      .lt('created_at', tenMinutesAgo)
      .limit(50);

    if (queryError) {
      console.error('[check-job-timeouts] Query error:', queryError);
      return res.status(500).json({
        error: 'Query failed',
        details: queryError.message
      });
    }

    if (!staleJobs || staleJobs.length === 0) {
      console.log('[check-job-timeouts] No stale jobs found');
      return res.status(200).json({
        message: 'No stale jobs found',
        marked: 0,
        duration_ms: Date.now() - startTime
      });
    }

    console.log(`[check-job-timeouts] Found ${staleJobs.length} stale jobs`);

    let marked = 0;
    let errors = [];

    // Mark each stale job as failed
    for (const job of staleJobs) {
      try {
        const processingDuration = Math.floor(
          (new Date().getTime() - new Date(job.created_at).getTime()) / 1000 / 60
        );

        console.log(`[check-job-timeouts] Marking job ${job.id} as TIMEOUT (${processingDuration}m)`);

        const { error: updateError } = await supabase
          .from('detection_jobs')
          .update({
            status: 'failed',
            stage: 'failed_timeout',
            error_code: 'TIMEOUT',
            error: `Processing timeout: job stuck in '${job.stage}' for ${processingDuration} minutes`,
            can_retry: true,
            progress: 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);

        if (updateError) {
          console.error(`[check-job-timeouts] Failed to mark job ${job.id}:`, updateError);
          errors.push(`Failed to mark ${job.id}`);
        } else {
          marked++;
        }
      } catch (err) {
        console.error(`[check-job-timeouts] Exception for job ${job.id}:`, err.message);
        errors.push(`Exception for ${job.id}: ${err.message}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[check-job-timeouts] Complete: ${marked} marked as failed in ${duration}ms`);

    return res.status(200).json({
      message: 'Timeout check completed',
      marked,
      errors: errors.length > 0 ? errors : undefined,
      checked: staleJobs.length,
      duration_ms: duration
    });

  } catch (error) {
    console.error('[check-job-timeouts] Fatal error:', error);
    return res.status(500).json({
      error: 'Timeout check failed',
      details: error.message,
      duration_ms: Date.now() - startTime
    });
  }
};
