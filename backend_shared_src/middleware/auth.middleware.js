import { supabase } from '../db/adapter.js';

/**
 * Extract user ID from JWT token or x-user-id header (for testing)
 * Sets req.userId and req.familyId for authenticated requests
 */
export async function extractUserFromToken(req, res, next) {
  // For testing: allow x-user-id header to bypass JWT verification
  const testUserId = req.headers['x-user-id'];
  if (testUserId) {
    try {
      // Lookup user and family from database
      const { data: userRecord, error: userRecordError } = await supabase
        .from('users')
        .select('id, family_id')
        .eq('id', testUserId)
        .single();

      if (userRecord && !userRecordError) {
        req.userId = userRecord.id;
        req.familyId = userRecord.family_id;
        req.user = { id: userRecord.id }; // Set req.user for controller compatibility
        if (userRecord.family_id) {
          req.headers['x-family-id'] = userRecord.family_id;
        }
        return next();
      }
    } catch (error) {
      console.warn('x-user-id lookup failed:', error.message);
    }
  }

  // Production: verify JWT token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      // Verify token with Supabase
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (user && !error) {
        let resolvedUserId = user.id;
        let resolvedFamilyId = null;

        try {
          // Prefer direct match on primary key (id)
          let { data: userRecord, error: userRecordError } = await supabase
            .from('users')
            .select('id, family_id')
            .eq('id', user.id)
            .single();

          if (userRecordError || !userRecord) {
            // Legacy fallback for schemas that used auth_id column
            const { data: legacyRecord } = await supabase
              .from('users')
              .select('id, family_id')
              .eq('auth_id', user.id)
              .single();

            if (legacyRecord) {
              userRecord = legacyRecord;
            }
          }

          if (userRecord) {
            resolvedUserId = userRecord.id;
            resolvedFamilyId = userRecord.family_id;
          }
        } catch (lookupError) {
          console.warn('User lookup failed:', lookupError.message);
        }

        // Set user context for downstream handlers
        req.userId = resolvedUserId;
        req.familyId = resolvedFamilyId;
        req.user = { id: resolvedUserId }; // Set req.user for controller compatibility
        req.headers['x-user-id'] = resolvedUserId;
        if (resolvedFamilyId) {
          req.headers['x-family-id'] = resolvedFamilyId;
        }
      }
    } catch (error) {
      console.error('Token verification failed:', error);
    }
  }
  next();
}

/**
 * Require authentication - returns 401 if user not authenticated
 */
export function requireAuth(req, res, next) {
  if (!req.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

/**
 * Require family membership - returns 403 if user doesn't have a family
 */
export function requireFamily(req, res, next) {
  if (!req.familyId) {
    return res.status(403).json({ error: 'Family membership required' });
  }
  next();
}
