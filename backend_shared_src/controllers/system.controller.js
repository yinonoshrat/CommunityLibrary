/**
 * System and utility controller functions
 * Handles health checks and system status
 */

/**
 * Health check endpoint
 * @route GET /api/health
 */
export const healthCheck = (req, res) => {
  const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'development';
  const dbUrl = process.env.SUPABASE_URL || process.env.POSTGRES_URL || '';
  const dbIdentifier = dbUrl.includes('supabase.co') 
    ? dbUrl.split('//')[1]?.split('.')[0] || 'unknown'
    : 'unknown';

  res.json({ 
    status: 'ok', 
    message: 'Community Library API is running',
    environment: environment,
    database: dbIdentifier,
    timestamp: new Date().toISOString(),
    env_check: {
      has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      has_anon_key: !!process.env.SUPABASE_ANON_KEY,
      has_url: !!process.env.SUPABASE_URL,
      service_key_prefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) || 'MISSING'
    }
  });
};
