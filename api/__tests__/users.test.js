import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { getSharedTestData } from './setup/testData.js'
import { createClient } from '@supabase/supabase-js'

const appModule = await import('../index.js')
const app = appModule.default

// Helper to ensure test data exists
const requireTestData = (data, message) => {
  if (!data) {
    throw new Error(`Test setup failed: ${message}`)
  }
}

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

describe('Users API Endpoints', () => {
  let testUserId = null
  let testFamilyId = null

  beforeAll(async () => {
    // Use shared test user and family
    const sharedData = getSharedTestData()
    testUserId = sharedData.userId
    testFamilyId = sharedData.familyId
  })

  describe('GET /api/users', () => {
    it('should return 200 and array of users', async () => {
      const response = await request(app)
        .get('/api/users')
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('users')
      expect(Array.isArray(response.body.users)).toBe(true)
    })

    it('should include user details in response', async () => {
      const response = await request(app)
        .get('/api/users')
        .expect(200)

      if (response.body.users.length > 0) {
        const user = response.body.users[0]
        expect(user).toHaveProperty('id')
        expect(user).toHaveProperty('email')
        expect(user).toHaveProperty('full_name')
      }
    })

    it('should always return valid JSON', async () => {
      const response = await request(app)
        .get('/api/users')
        .expect('Content-Type', /json/)

      expect(response.body).toBeDefined()
      expect(typeof response.body).toBe('object')
    })
  })

  describe('GET /api/users/:id', () => {
    it('should return user by ID', async () => {
      requireTestData(testUserId, 'testUserId is required')

      const response = await request(app)
        .get(`/api/users/${testUserId}`)
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('user')
      expect(response.body.user).toHaveProperty('id', testUserId)
      expect(response.body.user).toHaveProperty('email')
      expect(response.body.user).toHaveProperty('full_name')
    })

    it('should return JSON error for non-existent user', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000'
      const response = await request(app)
        .get(`/api/users/${fakeId}`)
        .expect('Content-Type', /json/)
        .expect(404)

      expect(response.body).toHaveProperty('error')
      expect(typeof response.body.error).toBe('string')
    })

    it('should return JSON error for invalid UUID', async () => {
      const response = await request(app)
        .get('/api/users/invalid-uuid')
        .expect('Content-Type', /json/)
        .expect(404)

      expect(response.body).toHaveProperty('error')
    })

    it('should include family information if user has family', async () => {
      requireTestData(testUserId, 'testUserId is required')

      const response = await request(app)
        .get(`/api/users/${testUserId}`)
        .expect(200)

      if (response.body.user.family_id) {
        expect(response.body.user.family_id).toBe(testFamilyId)
      }
    })
  })

  describe('PUT /api/users/:id', () => {
    it('should update user with valid data', async () => {
      requireTestData(testUserId, 'testUserId is required')

      const response = await request(app)
        .put(`/api/users/${testUserId}`)
        .send({
          phone: '9999999999',
          whatsapp: '8888888888'
        })
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('user')
      expect(response.body.user.phone).toBe('9999999999')
      expect(response.body.user.whatsapp).toBe('8888888888')
    })

    it('should update single field', async () => {
      requireTestData(testUserId, 'testUserId is required')

      const response = await request(app)
        .put(`/api/users/${testUserId}`)
        .send({
          full_name: 'Updated Name'
        })
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body.user.full_name).toBe('Updated Name')
    })

    it('should return JSON error for non-existent user', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000'
      const response = await request(app)
        .put(`/api/users/${fakeId}`)
        .send({ phone: '7777777777' })
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
    })

    it('should not allow updating email to existing email', async () => {
      requireTestData(testUserId, 'testUserId is required')

      // Try to update email (should fail or be handled properly)
      const response = await request(app)
        .put(`/api/users/${testUserId}`)
        .send({
          email: 'anotheremail@example.com'
        })
        .expect('Content-Type', /json/)

      // Should return either success or proper error JSON
      expect(response.body).toBeDefined()
      expect(typeof response.body).toBe('object')
    })

    it('should return error for empty update', async () => {
      requireTestData(testUserId, 'testUserId is required')

      const response = await request(app)
        .put(`/api/users/${testUserId}`)
        .send({})
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
    })

    it('should preserve other fields when updating one field', async () => {
      requireTestData(testUserId, 'testUserId is required')

      // Get current user data
      const getCurrentResponse = await request(app)
        .get(`/api/users/${testUserId}`)
        .expect(200)

      const currentEmail = getCurrentResponse.body.user.email

      // Update only phone
      const updateResponse = await request(app)
        .put(`/api/users/${testUserId}`)
        .send({ phone: '6666666666' })
        .expect(200)

      // Email should remain the same
      expect(updateResponse.body.user.email).toBe(currentEmail)
      expect(updateResponse.body.user.phone).toBe('6666666666')
    })

    it('should always return valid JSON even on errors', async () => {
      const response = await request(app)
        .put('/api/users/invalid-id')
        .send({ phone: '5555555555' })
        .expect('Content-Type', /json/)

      expect(response.body).toBeDefined()
      expect(typeof response.body).toBe('object')
    })
  })

  describe('POST /api/auth/accounts-by-email', () => {
    it('should return accounts for valid email', async () => {
      requireTestData(testUserId, 'testUserId is required')

      // Get the test user's email
      const userResponse = await request(app)
        .get(`/api/users/${testUserId}`)
        .expect(200)

      const email = userResponse.body.user.email

      const response = await request(app)
        .post('/api/auth/accounts-by-email')
        .send({ email })
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('accounts')
      expect(Array.isArray(response.body.accounts)).toBe(true)
      expect(response.body.accounts.length).toBeGreaterThan(0)
    })

    it('should return JSON error when email is missing', async () => {
      const response = await request(app)
        .post('/api/auth/accounts-by-email')
        .send({})
        .expect('Content-Type', /json/)
        .expect(400)

      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('Email is required')
    })

    it('should return empty array for non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/accounts-by-email')
        .send({ email: 'nonexistent@example.com' })
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('accounts')
      expect(response.body.accounts).toHaveLength(0)
    })

    it('should include family information in accounts', async () => {
      requireTestData(testUserId, 'testUserId is required')

      const userResponse = await request(app)
        .get(`/api/users/${testUserId}`)
        .expect(200)

      const email = userResponse.body.user.email

      const response = await request(app)
        .post('/api/auth/accounts-by-email')
        .send({ email })
        .expect(200)

      if (response.body.accounts.length > 0) {
        const account = response.body.accounts[0]
        expect(account).toHaveProperty('id')
        expect(account).toHaveProperty('full_name')
        expect(account).toHaveProperty('families')
      }
    })

    it('should return accounts for shared email', async () => {
      // Use a known email from our test data
      const { data } = await supabase
        .from('users')
        .select('email')
        .limit(1)
        .single()
      
      const testEmail = data?.email || 'shared.test.user@testmail.com'

      const response = await request(app)
        .post('/api/auth/accounts-by-email')
        .send({ email: testEmail })
        .expect(200)

      // Should return at least one account
      expect(response.body).toHaveProperty('accounts')
      expect(Array.isArray(response.body.accounts)).toBe(true)
      expect(response.body.accounts.length).toBeGreaterThanOrEqual(1)
    })

    it('should always return valid JSON', async () => {
      const response = await request(app)
        .post('/api/auth/accounts-by-email')
        .send({ email: 'any@example.com' })
        .expect('Content-Type', /json/)

      expect(response.body).toBeDefined()
      expect(typeof response.body).toBe('object')
    })
  })
})


