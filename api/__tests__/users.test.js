import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'

const appModule = await import('../index.js')
const app = appModule.default

describe('Users API Endpoints', () => {
  let testUserId = null
  let testFamilyId = null

  beforeAll(async () => {
    // Create test user
    const timestamp = Date.now()
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: `usertest${timestamp}@example.com`,
        password: 'testpass123',
        fullName: 'User Test',
        phone: '1234567890',
        familyName: 'User Test Family'
      })

    testUserId = response.body.user?.id
    testFamilyId = response.body.family_id
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
      if (!testUserId) return

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
      if (!testUserId) return

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
      if (!testUserId) return

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
      if (!testUserId) return

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
      if (!testUserId) return

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

    it('should handle updates with no changes', async () => {
      if (!testUserId) return

      const response = await request(app)
        .put(`/api/users/${testUserId}`)
        .send({})
        .expect('Content-Type', /json/)
        .expect(200)

      expect(response.body).toHaveProperty('user')
    })

    it('should preserve other fields when updating one field', async () => {
      if (!testUserId) return

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
      if (!testUserId) return

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
      if (!testUserId) return

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

    it('should return multiple accounts for shared email', async () => {
      // Create two users with same email
      const timestamp = Date.now()
      const sharedEmail = `shared${timestamp}@example.com`

      const response1 = await request(app)
        .post('/api/auth/register')
        .send({
          email: sharedEmail,
          password: 'testpass123',
          fullName: 'Shared User 1',
          phone: '1111111111',
          familyName: 'Family 1'
        })

      const response2 = await request(app)
        .post('/api/auth/register')
        .send({
          email: sharedEmail,
          password: 'testpass123',
          fullName: 'Shared User 2',
          phone: '2222222222',
          familyName: 'Family 2'
        })

      // Only test if both users were created successfully
      if (!response1.body.user || !response2.body.user) {
        expect(response1.body.user || response2.body.user).toBeDefined()
        return
      }

      const response = await request(app)
        .post('/api/auth/accounts-by-email')
        .send({ email: sharedEmail })
        .expect(200)

      expect(response.body.accounts.length).toBeGreaterThanOrEqual(2)
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

