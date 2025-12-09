import request from 'supertest'
import { createClient } from '@supabase/supabase-js'
import { beforeAll } from 'vitest'

// Initialize Supabase client (lazily to ensure env vars are loaded)
let supabase = null;
function getSupabase() {
  if (!supabase) {
    console.log('Initializing Supabase client with service role key');
    console.log('URL:', process.env.SUPABASE_URL);
    console.log('Service role key prefix:', process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) + '...');
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return supabase;
}

// Shared test data that will be created once and reused
export const TEST_USER = {
  email: 'shared.test.user@testmail.com',
  password: 'testpass123',
  fullName: 'Shared Test User',
  phone: '1234567890'
}

export const TEST_FAMILY = {
  name: 'Shared Test Family',
  phone: '1234567890'
}

let sharedTestData = {
  userId: null,
  familyId: null,
  authId: null,
  initialized: false
}

/**
 * Initialize shared test user and family (call once in global setup)
 */
export async function initializeSharedTestData(app) {
  const supabase = getSupabase();
  try {
    // Check if user already exists in database
    const { data: existingUser, error: userCheckError } = await supabase
      .from('users')
      .select('id, family_id')
      .eq('email', TEST_USER.email)
      .maybeSingle() // Use maybeSingle to avoid throwing on not found

    if (existingUser) {
      sharedTestData.userId = existingUser.id
      sharedTestData.familyId = existingUser.family_id
      sharedTestData.authId = existingUser.id // User ID is the auth ID
      console.log('✓ Using existing test user')
      return sharedTestData
    }
  } catch (err) {
    console.warn('Error checking for existing user:', err.message)
  }

  try {
    // Try to create user via Supabase Admin
    let authData
    
    const result = await supabase.auth.admin.createUser({
      email: TEST_USER.email,
      password: TEST_USER.password,
      email_confirm: true // Auto-confirm email for tests
    })
    
    // If user already exists in auth, get the existing user
    if (result.error && (result.error.code === 'email_exists' || result.error.status === 422)) {
      console.log('✓ Auth user already exists, signing in to get ID')
      // Sign in to get the auth user ID
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: TEST_USER.email,
        password: TEST_USER.password
      })
      
      if (signInError) {
        console.error('✗ Failed to sign in existing user:', signInError)
        throw new Error('Failed to sign in existing user')
      }
      
      authData = { user: signInData.user }
    } else if (result.error) {
      console.error('✗ Failed to create auth user:', result.error)
      throw new Error('Failed to create auth user')
    } else {
      authData = result.data
    }

    // Check if family exists
    const { data: existingFamily } = await supabase
      .from('families')
      .select('id')
      .eq('name', TEST_FAMILY.name)
      .maybeSingle()

    let familyId
    if (existingFamily) {
      familyId = existingFamily.id
      console.log('✓ Using existing test family')
    } else {
      // Create family
      const { data: familyData, error: familyError } = await supabase
        .from('families')
        .insert({
          name: TEST_FAMILY.name,
          phone: TEST_FAMILY.phone
        })
        .select()
        .single()

      if (familyError) {
        console.error('✗ Failed to create family:', familyError)
        throw new Error('Failed to create family')
      }
      familyId = familyData.id
      console.log('✓ Created new test family')
    }

    // Check if user record exists
    const { data: existingUserRecord } = await supabase
      .from('users')
      .select('id, family_id')
      .eq('id', authData.user.id)
      .maybeSingle()

    if (existingUserRecord) {
      sharedTestData.userId = existingUserRecord.id
      sharedTestData.familyId = existingUserRecord.family_id
      sharedTestData.authId = existingUserRecord.id
      console.log('✓ Using existing test user record')
      return sharedTestData
    }

    // Create user record
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id, // User ID is the auth user ID
        email: TEST_USER.email,
        auth_email: TEST_USER.email, // For tests, keep them the same
        full_name: TEST_USER.fullName,
        phone: TEST_USER.phone,
        whatsapp: TEST_USER.phone,
        family_id: familyId,
        is_family_admin: true
      })
      .select()
      .single()

    if (userError) {
      console.error('✗ Failed to create user record:', userError)
      throw new Error('Failed to create user record')
    }

    sharedTestData.userId = userData.id
    sharedTestData.familyId = userData.family_id
    sharedTestData.authId = authData.user.id
    sharedTestData.initialized = true
    console.log('✓ Created new test user and family')

    return sharedTestData
  } catch (err) {
    console.error('✗ Error initializing test data:', err)
    throw err
  }
}

/**
 * Get the shared test data (use in tests)
 */
export function getSharedTestData() {
  return sharedTestData
}

/**
 * Clean up test data created during tests (not the shared user/family)
 */
export async function cleanupTestData(app, itemType, itemId) {
  // Helper to delete specific test items created during tests
  const endpoints = {
    book: `/api/books/${itemId}`,
    loan: `/api/loans/${itemId}`,
    review: `/api/reviews/${itemId}`,
    // Note: users and families use the shared ones, so don't delete
  }

  if (endpoints[itemType]) {
    await request(app).delete(endpoints[itemType])
  }
}

// Initialize shared test data before all tests
// This runs in the same process as the tests
beforeAll(async () => {
  if (!sharedTestData.initialized) {
    try {
      const appModule = await import('../../index.js')
      const app = appModule.default
      await initializeSharedTestData(app)
    } catch (error) {
      console.warn('⚠ Failed to initialize shared test data (tests may skip):', error.message)
      // Don't throw - allow tests to run and skip if needed
    }
  }
})
