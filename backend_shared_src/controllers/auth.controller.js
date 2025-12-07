import { db, supabase, supabaseAuth as authClient } from '../db/adapter.js';
import { asyncHandler } from '../middleware/errorHandler.middleware.js';

/**
 * Register new user with email/password
 * @route POST /api/auth/register
 */
export const register = asyncHandler(async (req, res) => {
  const { email, password, fullName, phone, whatsapp, familyName, familyPhone, familyWhatsapp, existingFamilyId } = req.body;

  console.log('Registration attempt:', { email, fullName, familyName, existingFamilyId });

  // Validate required fields
  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'Missing required fields: email, password, fullName' });
  }

  // Create unique auth email by appending UUID to handle shared emails
  // The actual email is stored in the users table
  // Use dot notation for better email validation compatibility
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8); // Letters only, no numbers at start
  const uniqueAuthEmail = `${email.split('@')[0]}.${randomStr}.${timestamp}@${email.split('@')[1]}`;

  // Create auth user with unique email
  const { data: authData, error: authError } = await authClient.auth.signUp({
    email: uniqueAuthEmail,
    password,
  });

  if (authError) {
    console.error('Auth signup error:', authError);
    return res.status(400).json({ error: authError.message });
  }

  if (!authData.user) {
    return res.status(400).json({ error: 'Failed to create user' });
  }

  // Determine family ID
  let familyId = null;

  if (existingFamilyId) {
    // Join existing family
    familyId = existingFamilyId;
    console.log('Joining existing family:', familyId);
  } else if (familyName) {
    // Create new family - use direct supabase call with service role to bypass RLS
    console.log('Creating new family:', { familyName, phone: familyPhone || phone });
    console.log('Environment check:');
    console.log('  - SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? `Present (${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...)` : 'MISSING');
    console.log('  - SUPABASE_URL:', process.env.SUPABASE_URL || 'MISSING');
    console.log('  - supabase client headers:', supabase.rest?.headers || 'N/A');

    const { data: newFamily, error: familyError } = await supabase
      .from('families')
      .insert({
        name: familyName,
        phone: familyPhone || phone,
        whatsapp: familyWhatsapp || whatsapp || phone,
        email
      })
      .select()
      .single();

    if (familyError) {
      console.error('Family creation error:', familyError);
      console.error('Error code:', familyError.code);
      console.error('Error message:', familyError.message);
      console.error('Error details:', familyError.details);
      console.error('Full error object:', JSON.stringify(familyError, null, 2));

      // Clean up the auth user if family creation fails
      try {
        await supabase.auth.admin.deleteUser(authData.user.id);
        console.log('Auth user cleaned up after family creation failure');
      } catch (cleanupError) {
        console.error('Failed to cleanup auth user:', cleanupError.message);
      }

      return res.status(400).json({ error: 'Failed to create family: ' + familyError.message });
    }

    console.log('Family created successfully:', newFamily.id);
    familyId = newFamily.id;
  }

  // Create user profile with actual email and auth_email
  const user = await db.users.create({
    id: authData.user.id,
    email, // Store the actual shared email
    auth_email: uniqueAuthEmail, // Store the unique auth email
    full_name: fullName,
    phone,
    whatsapp: whatsapp || phone,
    family_id: familyId,
    is_family_admin: existingFamilyId ? false : (familyId ? true : false)
  });

  res.status(201).json({ user, family_id: familyId });
});

/**
 * Get all user accounts associated with an email
 * @route POST /api/auth/accounts-by-email
 */
export const getAccountsByEmail = asyncHandler(async (req, res) => {
  const { email } = req.body;

  console.log('[getAccountsByEmail] === REQUEST RECEIVED ===');
  console.log('[getAccountsByEmail] Email:', email);

  if (!email) {
    console.error('[getAccountsByEmail] ✗ No email provided');
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    console.log('[getAccountsByEmail] Querying database...');
    
    // Get all users with this email
    const { data: users, error } = await supabase
      .from('users')
      .select('id, full_name, email, families(id, name)')
      .eq('email', email)
      .order('full_name');

    if (error) {
      console.error('[getAccountsByEmail] ✗ Database error:', error.message);
      console.error('[getAccountsByEmail] Error code:', error.code);
      console.error('[getAccountsByEmail] Error details:', error.details);
      return res.status(500).json({ error: 'Failed to fetch accounts' });
    }

    console.log('[getAccountsByEmail] ✓ Found', users?.length || 0, 'accounts');
    res.json({ accounts: users || [] });
  } catch (err) {
    console.error('[getAccountsByEmail] ✗ Unexpected error:', err.message);
    console.error('[getAccountsByEmail] Stack:', err.stack);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Login with email/password
 * @route POST /api/auth/login
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password, userId, rememberMe } = req.body;

  let authEmail = email;
  
  // If userId is provided, get the auth_email for that specific user
  if (userId) {
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('auth_email, email')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    authEmail = userData.auth_email || userData.email;
  } else {
    // No userId provided - look up by regular email
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, auth_email, email')
      .eq('email', email);

    if (userError || !users || users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // If multiple users share this email, require userId
    if (users.length > 1) {
      return res.status(400).json({ 
        error: 'Multiple accounts found',
        message: 'This email is shared by multiple users. Please select an account.',
        users: users.map(u => ({ 
          id: u.id,
          email: u.email 
        }))
      });
    }

    // Single user found - use their auth_email
    authEmail = users[0].auth_email || users[0].email;
  }

  const { data, error } = await authClient.auth.signInWithPassword({
    email: authEmail,
    password,
  });

  if (error) {
    return res.status(401).json({ error: error.message || 'Invalid credentials' });
  }

  // Update remember_me preference
  if (rememberMe !== undefined) {
    await db.users.update(data.user.id, { remember_me: rememberMe });
  }

  // Get full user profile
  const user = await db.users.getById(data.user.id);

  res.json({ session: data.session, user });
});

/**
 * Logout current user
 * @route POST /api/auth/logout
 */
export const logout = asyncHandler(async (req, res) => {
  const { error } = await authClient.auth.signOut();
  if (error) {
    return res.status(400).json({ error: error.message || 'Logout failed' });
  }
  res.json({ message: 'Logged out successfully' });
});

/**
 * Complete OAuth registration (Google/Facebook)
 * @route POST /api/auth/oauth-complete
 */
export const completeOAuth = asyncHandler(async (req, res) => {
  const { id, email, fullName, provider, phone, whatsapp, familyName, familyPhone, familyWhatsapp, existingFamilyId } = req.body;

  console.log('OAuth completion attempt:', { id, email, fullName, provider, phone, familyName, existingFamilyId });

  // Validate required fields
  if (!id || !email || !fullName || !phone) {
    return res.status(400).json({ error: 'Missing required fields: id, email, fullName, phone' });
  }

  // Check if user already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('id', id)
    .single();

  if (existingUser) {
    console.log('User already exists:', id);
    const user = await db.users.getById(id);
    return res.json({ user, family_id: user.family_id });
  }

  // Determine family ID
  let familyId = null;

  if (existingFamilyId) {
    // Join existing family
    familyId = existingFamilyId;
    console.log('Joining existing family:', familyId);
  } else if (familyName) {
    // Create new family
    console.log('Creating new family:', { familyName, familyPhone });

    const { data: newFamily, error: familyError } = await supabase
      .from('families')
      .insert({
        name: familyName,
        phone: familyPhone,
        whatsapp: familyWhatsapp || familyPhone,
        email
      })
      .select()
      .single();

    if (familyError) {
      console.error('Family creation error:', familyError);
      return res.status(400).json({ error: 'Failed to create family: ' + familyError.message });
    }

    console.log('Family created successfully:', newFamily.id);
    familyId = newFamily.id;
  }

  // Create user profile with family information
  const user = await db.users.create({
    id,
    email,
    auth_email: email, // OAuth users use their actual email
    full_name: fullName,
    phone,
    whatsapp: whatsapp || phone,
    family_id: familyId,
    is_family_admin: existingFamilyId ? false : (familyId ? true : false)
  });

  console.log('OAuth user created successfully:', user.id);
  res.status(201).json({ user, family_id: familyId });
});

/**
 * Get current authenticated user
 * @route GET /api/auth/me
 */
export const getCurrentUser = asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await authClient.auth.getUser(token);

  if (error) {
    console.error('Error getting current user:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    const userProfile = await db.users.getById(user.id);
    res.json({ user: userProfile });
  } catch (err) {
    // User exists in Supabase Auth but not in our database yet
    console.log('User authenticated but not found in database:', user.id);
    return res.status(404).json({ error: 'User not found in database' });
  }
});
